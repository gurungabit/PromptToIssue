/**
 * AIDE Message Converter
 * 
 * Converts AI SDK V3 prompts to AIDE API format for both
 * Anthropic (Claude) and OpenAI (GPT) models
 */

import type {
  LanguageModelV3Prompt,
  LanguageModelV3Message,
  LanguageModelV3FunctionTool,
  LanguageModelV3ToolChoice,
} from '@ai-sdk/provider';

import type {
  AnthropicMessage,
  AnthropicContent,
  AnthropicTool,
  AnthropicRequestBody,
  OpenAIMessage,
  OpenAIContentPart,
  OpenAITool,
  OpenAIRequestBody,
  AideRequestBody,
  AideModelInfo,
} from './aide-types';

// =============================================================================
// Anthropic (Claude) Conversion
// =============================================================================

/**
 * Convert SDK prompt to Anthropic message format
 */
function convertToAnthropicMessages(prompt: LanguageModelV3Prompt): {
  system: string | undefined;
  messages: AnthropicMessage[];
} {
  let system: string | undefined;
  const messages: AnthropicMessage[] = [];

  for (const message of prompt) {
    switch (message.role) {
      case 'system':
        // Anthropic uses a separate system parameter
        system = message.content;
        break;

      case 'user': {
        const content: AnthropicContent[] = [];
        for (const part of message.content) {
          if (part.type === 'text') {
            content.push({ type: 'text', text: part.text });
          } else if (part.type === 'file') {
            // Handle image files
            if (part.mediaType.startsWith('image/')) {
              const data = typeof part.data === 'string' 
                ? part.data 
                : Buffer.from(part.data as Uint8Array).toString('base64');
              content.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: part.mediaType,
                  data,
                },
              });
            }
          }
        }
        messages.push({ role: 'user', content });
        break;
      }

      case 'assistant': {
        const content: AnthropicContent[] = [];
        for (const part of message.content) {
          if (part.type === 'text') {
            content.push({ type: 'text', text: part.text });
          } else if (part.type === 'tool-call') {
            content.push({
              type: 'tool_use',
              id: part.toolCallId,
              name: part.toolName,
              input: typeof part.input === 'string' ? JSON.parse(part.input) : part.input,
            });
          }
        }
        messages.push({ role: 'assistant', content });
        break;
      }

      case 'tool': {
        // Tool results need to be added to the previous user message or create a new user message
        const content: AnthropicContent[] = [];
        for (const part of message.content) {
          if (part.type === 'tool-result') {
            let resultContent: string | AnthropicContent[];
            
            if (part.output.type === 'text') {
              resultContent = part.output.value;
            } else if (part.output.type === 'json') {
              resultContent = JSON.stringify(part.output.value);
            } else if (part.output.type === 'error-text') {
              resultContent = `Error: ${part.output.value}`;
            } else if (part.output.type === 'error-json') {
              resultContent = `Error: ${JSON.stringify(part.output.value)}`;
            } else {
              resultContent = String(part.output);
            }

            content.push({
              type: 'tool_result',
              tool_use_id: part.toolCallId,
              content: resultContent,
            });
          }
        }
        // Tool results go in a user message for Anthropic
        messages.push({ role: 'user', content });
        break;
      }
    }
  }

  return { system, messages };
}

/**
 * Convert SDK tools to Anthropic tool format
 */
function convertToAnthropicTools(
  tools: LanguageModelV3FunctionTool[] | undefined
): AnthropicTool[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  return tools
    .filter((tool): tool is LanguageModelV3FunctionTool => tool.type === 'function')
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Record<string, unknown>,
    }));
}

/**
 * Convert SDK tool choice to Anthropic format
 */
function convertToAnthropicToolChoice(
  toolChoice: LanguageModelV3ToolChoice | undefined
): { type: 'auto' | 'any' | 'tool'; name?: string } | undefined {
  if (!toolChoice) return undefined;

  if (toolChoice.type === 'auto') return { type: 'auto' };
  if (toolChoice.type === 'none') return undefined; // No tool_choice means no tools used
  if (toolChoice.type === 'required') return { type: 'any' };
  if (toolChoice.type === 'tool') {
    return { type: 'tool', name: toolChoice.toolName };
  }

  return undefined;
}

// =============================================================================
// OpenAI (GPT) Conversion
// =============================================================================

/**
 * Convert SDK prompt to OpenAI message format
 */
function convertToOpenAIMessages(prompt: LanguageModelV3Prompt): OpenAIMessage[] {
  const messages: OpenAIMessage[] = [];

  for (const message of prompt) {
    switch (message.role) {
      case 'system':
        messages.push({ role: 'system', content: message.content });
        break;

      case 'user': {
        const contentParts: OpenAIContentPart[] = [];
        for (const part of message.content) {
          if (part.type === 'text') {
            contentParts.push({ type: 'text', text: part.text });
          } else if (part.type === 'file') {
            if (part.mediaType.startsWith('image/')) {
              const data = typeof part.data === 'string'
                ? part.data
                : Buffer.from(part.data as Uint8Array).toString('base64');
              contentParts.push({
                type: 'image_url',
                image_url: {
                  url: `data:${part.mediaType};base64,${data}`,
                },
              });
            }
          }
        }
        // If only text, use simple string format
        if (contentParts.length === 1 && contentParts[0].type === 'text') {
          messages.push({ role: 'user', content: contentParts[0].text });
        } else {
          messages.push({ role: 'user', content: contentParts });
        }
        break;
      }

      case 'assistant': {
        let textContent = '';
        const toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> = [];

        for (const part of message.content) {
          if (part.type === 'text') {
            textContent += part.text;
          } else if (part.type === 'tool-call') {
            toolCalls.push({
              id: part.toolCallId,
              type: 'function',
              function: {
                name: part.toolName,
                arguments: typeof part.input === 'string' ? part.input : JSON.stringify(part.input),
              },
            });
          }
        }

        const msg: OpenAIMessage = {
          role: 'assistant',
          content: textContent || null,
        };
        if (toolCalls.length > 0) {
          msg.tool_calls = toolCalls;
        }
        messages.push(msg);
        break;
      }

      case 'tool': {
        for (const part of message.content) {
          if (part.type === 'tool-result') {
            let resultContent: string;

            if (part.output.type === 'text') {
              resultContent = part.output.value;
            } else if (part.output.type === 'json') {
              resultContent = JSON.stringify(part.output.value);
            } else if (part.output.type === 'error-text') {
              resultContent = part.output.value;
            } else if (part.output.type === 'error-json') {
              resultContent = JSON.stringify(part.output.value);
            } else {
              resultContent = String(part.output);
            }

            messages.push({
              role: 'tool',
              tool_call_id: part.toolCallId,
              content: resultContent,
            });
          }
        }
        break;
      }
    }
  }

  return messages;
}

/**
 * Convert SDK tools to OpenAI tool format
 */
function convertToOpenAITools(
  tools: LanguageModelV3FunctionTool[] | undefined
): OpenAITool[] | undefined {
  if (!tools || tools.length === 0) return undefined;

  return tools
    .filter((tool): tool is LanguageModelV3FunctionTool => tool.type === 'function')
    .map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema as Record<string, unknown>,
        strict: tool.strict,
      },
    }));
}

/**
 * Convert SDK tool choice to OpenAI format
 */
function convertToOpenAIToolChoice(
  toolChoice: LanguageModelV3ToolChoice | undefined
): 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } } | undefined {
  if (!toolChoice) return undefined;

  if (toolChoice.type === 'auto') return 'auto';
  if (toolChoice.type === 'none') return 'none';
  if (toolChoice.type === 'required') return 'required';
  if (toolChoice.type === 'tool') {
    return { type: 'function', function: { name: toolChoice.toolName } };
  }

  return undefined;
}

// =============================================================================
// Main Conversion Functions
// =============================================================================

export interface ConvertedRequest {
  body: AideRequestBody;
  warnings: Array<{ type: string; message: string }>;
}

export interface ConversionOptions {
  prompt: LanguageModelV3Prompt;
  modelInfo: AideModelInfo;
  solmaId: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  tools?: LanguageModelV3FunctionTool[];
  toolChoice?: LanguageModelV3ToolChoice;
  aideOptions?: {
    scrubInput?: boolean;
    applyGuardrail?: boolean;
    failOnScrub?: boolean;
  };
}

/**
 * Convert AI SDK request to AIDE API request body
 */
export function convertToAideRequest(options: ConversionOptions): ConvertedRequest {
  const warnings: Array<{ type: string; message: string }> = [];
  const {
    prompt,
    modelInfo,
    solmaId,
    maxTokens = modelInfo.maxTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    tools,
    toolChoice,
    aideOptions = {},
  } = options;

  // Base AIDE configuration
  const baseRequest: AideRequestBody = {
    aide: {
      scrub_input: aideOptions.scrubInput ?? true,
      apply_guardrail: aideOptions.applyGuardrail ?? true,
      fail_on_scrub: aideOptions.failOnScrub ?? true,
    },
    gaas: {
      guardrailsEnabled: false, // Use AIDE config instead
      scrubInput: false, // Use AIDE config instead
      scrubbingTimeoutSeconds: 8,
      pathToPrompt: '', // Will be set based on model type
      logMetadata: {
        solmaId,
      },
    },
  };

  // Filter tools to only function tools
  const functionTools = tools?.filter(
    (tool): tool is LanguageModelV3FunctionTool => tool.type === 'function'
  );

  if (modelInfo.type === 'anthropic') {
    // Anthropic (Claude) format
    const { system, messages } = convertToAnthropicMessages(prompt);
    const anthropicTools = convertToAnthropicTools(functionTools);
    const anthropicToolChoice = convertToAnthropicToolChoice(toolChoice);

    baseRequest.gaas.pathToPrompt = 'aws.bedrock.invoke.body.messages[*].content[*].text';
    baseRequest.aws = {
      bedrock: {
        invoke: {
          modelId: modelInfo.aideModelId,
          body: {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: maxTokens,
            messages,
            ...(system && { system }),
            ...(temperature !== undefined && { temperature }),
            ...(topP !== undefined && { top_p: topP }),
            ...(topK !== undefined && { top_k: topK }),
            ...(stopSequences && { stop_sequences: stopSequences }),
            ...(anthropicTools && { tools: anthropicTools }),
            ...(anthropicToolChoice && { tool_choice: anthropicToolChoice }),
          },
        },
      },
    };

    // Warn about unsupported options
    if (frequencyPenalty !== undefined) {
      warnings.push({
        type: 'unsupported-setting',
        message: 'frequencyPenalty is not supported by Anthropic models',
      });
    }
    if (presencePenalty !== undefined) {
      warnings.push({
        type: 'unsupported-setting',
        message: 'presencePenalty is not supported by Anthropic models',
      });
    }
  } else {
    // OpenAI (GPT) format
    const messages = convertToOpenAIMessages(prompt);
    const openAITools = convertToOpenAITools(functionTools);
    const openAIToolChoice = convertToOpenAIToolChoice(toolChoice);

    baseRequest.gaas.pathToPrompt = 'azure.openai.chatCompletions.create.messages[*].content';
    baseRequest.azure = {
      openai: {
        apiVersion: '2024-10-21',
        chatCompletions: {
          create: {
            model: modelInfo.aideModelId,
            messages,
            ...(maxTokens !== undefined && { max_tokens: maxTokens }),
            ...(temperature !== undefined && { temperature }),
            ...(topP !== undefined && { top_p: topP }),
            ...(frequencyPenalty !== undefined && { frequency_penalty: frequencyPenalty }),
            ...(presencePenalty !== undefined && { presence_penalty: presencePenalty }),
            ...(stopSequences && { stop: stopSequences }),
            ...(openAITools && { tools: openAITools }),
            ...(openAIToolChoice && { tool_choice: openAIToolChoice }),
          },
        },
      },
    };

    // Warn about unsupported options
    if (topK !== undefined) {
      warnings.push({
        type: 'unsupported-setting',
        message: 'topK is not supported by OpenAI models',
      });
    }
  }

  return { body: baseRequest, warnings };
}
