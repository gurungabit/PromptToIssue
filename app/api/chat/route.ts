import { streamText, stepCountIs, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import { getModel, getDefaultModel } from '@/lib/ai/models/registry';
import { getModelConfig } from '@/lib/ai/models/config';
import { db } from '@/lib/db/client';
import type { MessagePart } from '@/lib/db/schema';
import { nanoid } from 'nanoid';
import { DEFAULT_SYSTEM_PROMPT } from '@/lib/ai/prompts/system';

// AI SDK v6 uses parts-based message format, but we need to handle both formats
const partSchema = z.looseObject({
  type: z.string(),
  text: z.string().optional(),
});

const messageSchema = z.looseObject({
  id: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system']),
  // Accept either parts array or content string
  parts: z.array(partSchema).optional(),
  content: z.union([z.string(), z.array(z.any())]).optional(),
});

const chatRequestSchema = z.looseObject({
  messages: z.array(messageSchema),
  chatId: z.string().optional(),
  modelId: z.string().optional(),
  mcpEnabled: z.boolean().optional(),
});

// Extract text content from message (handles both parts and content formats)
function getMessageContent(message: z.infer<typeof messageSchema>): string {
  // Handle parts-based format
  if (message.parts && message.parts.length > 0) {
    return message.parts
      .filter((part) => part.type === 'text' && part.text)
      .map((part) => part.text!)
      .join('');
  }
  // Handle content-based format
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter(
        (item): item is { type: string; text: string } =>
          typeof item === 'object' && item.type === 'text' && typeof item.text === 'string',
      )
      .map((item) => item.text)
      .join('');
  }
  return '';
}

// Convert messages to content-based for streamText
function convertToModelMessages(messages: z.infer<typeof messageSchema>[]) {
  return messages.map((msg) => ({
    role: msg.role,
    content: getMessageContent(msg),
  }));
}

// Allow streaming responses up to 5 minutes
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      console.error('Validation error:', parsed.error.issues);
      return new Response(
        JSON.stringify({
          error: 'Invalid request body',
          details: parsed.error.issues,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { messages, chatId, modelId } = parsed.data;

    // Get model - use specified or default
    let model;
    let modelConfig;

    if (modelId) {
      model = getModel(modelId);
      modelConfig = getModelConfig(modelId);
    } else {
      const defaultResult = getDefaultModel();
      model = defaultResult.model;
      modelConfig = defaultResult.config;
    }

    if (!modelConfig) {
      return new Response(JSON.stringify({ error: 'Model not found or not enabled' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create or get chat
    let currentChatId = chatId;

    if (!currentChatId) {
      // Create new chat with first message as title
      const firstUserMessage = messages.find((m) => m.role === 'user');
      const title = getMessageContent(firstUserMessage!).slice(0, 100) || 'New Chat';

      currentChatId = nanoid();
      await db.createChat({
        id: currentChatId,
        userId: session.user.id,
        title,
        modelId: modelConfig.id,
      });
    }

    // Save user message to database
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage?.role === 'user') {
      await db.addMessage({
        id: nanoid(),
        chatId: currentChatId,
        role: 'user',
        content: getMessageContent(lastUserMessage),
      });
    }

    // Get system prompt
    const systemPrompt = modelConfig.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;

    // Convert messages for streamText
    const modelMessages = convertToModelMessages(messages);

    // Check if user has GitLab connected and MCP is enabled
    const userSettings = await db.getUserSettings(session.user.id);

    // Get tokens from cookies (preferred) or DB (fallback)
    const cookieStore = await cookies();
    const cookieAccessToken = cookieStore.get('gitlab_access_token')?.value;
    const cookieRefreshToken = cookieStore.get('gitlab_refresh_token')?.value; // although we don't strictly need refresh token for the tools execution, we pass it just in case

    const accessToken = cookieAccessToken || userSettings?.gitlabAccessToken;
    const refreshToken = cookieRefreshToken || userSettings?.gitlabRefreshToken;

    // Default to true if not specified (backward compatibility)
    const toolsEnabled = parsed.data.mcpEnabled !== false;

    console.log('[API] Chat request:', {
      hasCookieToken: !!cookieAccessToken,
      hasDbToken: !!userSettings?.gitlabAccessToken,
      mcpEnabledParam: parsed.data.mcpEnabled,
      toolsEnabled,
      modelId,
    });

    // Use createUIMessageStream to support custom data streaming (e.g., research sub-agent steps)
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Create tools with writer so sub-agents can stream progress
        let tools = {};

        if (accessToken && toolsEnabled) {
          console.log('[API] Loading GitLab tools...');
          const { createGitLabTools } = await import('@/lib/mcp/gitlab-tools');
          tools = createGitLabTools(
            {
              accessToken,
              refreshToken,
              userId: session.user.id,
            },
            modelId,
            writer as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- SDK writer type is compatible but TS can't prove it due to contravariance
          );
          console.log('[API] Tools loaded:', Object.keys(tools));
        } else {
          console.log('[API] Tools disabled or no token');
        }

        // Aggregate tool calls and results across steps
        interface ToolCall {
          toolCallId: string;
          toolName: string;
          args: Record<string, unknown>;
        }
        interface ToolResult {
          toolCallId: string;
          toolName: string;
          result: unknown;
        }

        const allToolCalls: ToolCall[] = [];
        const allToolResults: ToolResult[] = [];

        // Stream the response
        const result = streamText({
          model,
          system: systemPrompt,
          messages: modelMessages,
          tools: Object.keys(tools).length > 0 ? tools : undefined,
          // Allow up to 20 steps for tool continuation
          // stepCountIs stops when step count reaches the specified number
          stopWhen: stepCountIs(20),
          onStepFinish: async ({ toolCalls, toolResults }) => {
            if (toolCalls) {
              allToolCalls.push(
                ...toolCalls.map((tc) => ({
                  toolCallId: tc.toolCallId,
                  toolName: tc.toolName,
                  // Cast to access SDK-specific property 'args' or 'input' safely
                  args: ((tc as unknown as { args: Record<string, unknown> }).args ||
                    (tc as unknown as { input: Record<string, unknown> }).input ||
                    {}) as Record<string, unknown>,
                })),
              );
            }
            if (toolResults) {
              allToolResults.push(
                ...toolResults.map((tr) => ({
                  toolCallId: tr.toolCallId,
                  toolName: tr.toolName,
                  // Cast to access SDK-specific property 'result' or 'output' safely
                  result:
                    (tr as unknown as { result: unknown }).result ||
                    (tr as unknown as { output: unknown }).output,
                })),
              );
            }
          },
          onFinish: async ({ text }) => {
            // Construct parts array for persistence from aggregated data
            const parts: MessagePart[] = [];
            if (text) {
              parts.push({ type: 'text', text });
            }

            allToolCalls.forEach((tc) => {
              parts.push({
                type: 'tool-call',
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args,
              });
            });

            allToolResults.forEach((tr) => {
              parts.push({
                type: 'tool-result',
                toolCallId: tr.toolCallId,
                toolName: tr.toolName,
                result: tr.result,
              });

              // If this tool result is from research_project, extract and persist sub-agent steps
              if (
                tr.toolName === 'research_project' &&
                tr.result &&
                typeof tr.result === 'object' &&
                'toolsUsed' in (tr.result as Record<string, unknown>)
              ) {
                const researchResult = tr.result as {
                  toolsUsed?: Array<{ toolName: string; status: string }>;
                };
                if (researchResult.toolsUsed) {
                  parts.push({
                    type: 'research-steps' as MessagePart['type'],
                    toolCallId: tr.toolCallId,
                    steps: researchResult.toolsUsed,
                  } as unknown as MessagePart);
                }
              }
            });

            console.log('[API] Saving parts count:', parts.length, 'Tools:', allToolCalls.length);

            // Save assistant message to database with parts
            await db.addMessage({
              id: nanoid(),
              chatId: currentChatId!,
              role: 'assistant',
              content: text || '',
              parts: parts.length > 0 ? parts : undefined,
            });
          },
        });

        // Merge the streamText result into our custom stream
        writer.merge(result.toUIMessageStream());
      },
    });

    // Return streaming response with chat ID in headers
    const response = createUIMessageStreamResponse({ stream });
    response.headers.set('X-Chat-Id', currentChatId);

    return response;
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
