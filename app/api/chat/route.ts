import { streamText, stepCountIs } from 'ai';
import { z } from 'zod';
import { auth } from '@/lib/auth/auth';
import { getModel, getDefaultModel } from '@/lib/ai/models/registry';
import { getModelConfig } from '@/lib/ai/models/config';
import { db } from '@/lib/db/client';
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
      .filter((item): item is { type: string; text: string } => 
        typeof item === 'object' && item.type === 'text' && typeof item.text === 'string'
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
        JSON.stringify({ error: 'Invalid request body', details: parsed.error.issues }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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
      return new Response(
        JSON.stringify({ error: 'Model not found or not enabled' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
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
    let tools = {};
    const userSettings = await db.getUserSettings(session.user.id);
    
    // Default to true if not specified (backward compatibility)
    const toolsEnabled = parsed.data.mcpEnabled !== false;
    
    console.log('[API] Chat request:', {
      hasToken: !!userSettings?.gitlabAccessToken,
      mcpEnabledParam: parsed.data.mcpEnabled,
      toolsEnabled,
      modelId
    });

    if (userSettings?.gitlabAccessToken && toolsEnabled) {
      console.log('[API] Loading GitLab tools...');
      // Import and create GitLab tools dynamically
      const { createGitLabTools } = await import('@/lib/mcp/gitlab-tools');
      tools = createGitLabTools({
        accessToken: userSettings.gitlabAccessToken,
        refreshToken: userSettings.gitlabRefreshToken,
        userId: session.user.id,
      }, modelId);
      console.log('[API] Tools loaded:', Object.keys(tools));
    } else {
      console.log('[API] Tools disabled or no token');
    }
    
    // Stream the response
    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      // Allow up to 5 steps for tool continuation
      // stepCountIs stops when step count reaches the specified number
      stopWhen: stepCountIs(5),
      onFinish: async ({ text }) => {
        // Save assistant message to database
        await db.addMessage({
          id: nanoid(),
          chatId: currentChatId!,
          role: 'assistant',
          content: text,
        });
      },
    });
    
    // Return streaming response with chat ID in headers
    const response = result.toUIMessageStreamResponse();
    response.headers.set('X-Chat-Id', currentChatId);
    
    return response;
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
