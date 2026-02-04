/**
 * AIDE Language Model
 * 
 * Implements the AI SDK LanguageModelV3 interface for the State Farm AIDE LLM API.
 * Supports both AWS Bedrock (Claude) and Azure OpenAI (GPT) models.
 */

import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
  LanguageModelV3Content,
  LanguageModelV3Usage,
  LanguageModelV3FinishReason,
  LanguageModelV3FunctionTool,
} from '@ai-sdk/provider';

import type {
  AideProviderSettings,
  AideModelSettings,
  AideModelInfo,
  AideRequestBody,
  AideResponseBody,
  AnthropicResponse,
  OpenAIResponse,
} from './aide-types';
import { AIDE_MODELS } from './aide-types';
import { convertToAideRequest } from './aide-message-converter';
import { createSimulatedStream, createErrorStream } from './aide-stream-simulator';
import { createTokenFetcher } from './aide-token-fetcher';

export interface AideLanguageModelConfig {
  provider: string;
  baseURL: string;
  useCaseId: string;
  solmaId: string;
  getAuthToken: () => Promise<string>;
  headers?: Record<string, string>;
  aideOptions?: {
    scrubInput?: boolean;
    applyGuardrail?: boolean;
    failOnScrub?: boolean;
  };
}

/**
 * AIDE Language Model implementation
 */
export class AideLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider: string;
  readonly modelId: string;
  
  private readonly config: AideLanguageModelConfig;
  private readonly modelInfo: AideModelInfo;
  private readonly settings: AideModelSettings;

  constructor(
    modelId: string,
    settings: AideModelSettings,
    config: AideLanguageModelConfig
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
    this.provider = config.provider;

    // Get model info
    const modelInfo = AIDE_MODELS[modelId];
    if (!modelInfo) {
      throw new Error(
        `Unknown AIDE model: ${modelId}. ` +
        `Available models: ${Object.keys(AIDE_MODELS).join(', ')}`
      );
    }
    this.modelInfo = modelInfo;
  }

  /**
   * Supported URL patterns - AIDE doesn't support direct URL access
   */
  get supportedUrls(): Record<string, RegExp[]> {
    return {};
  }

  /**
   * Make the API request to AIDE
   */
  private async callAideApi(
    body: AideRequestBody,
    abortSignal?: AbortSignal
  ): Promise<AideResponseBody> {
    const token = await this.config.getAuthToken();

    const response = await fetch(`${this.config.baseURL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'UseCaseID': this.config.useCaseId,
        'Authorization': `Bearer ${token}`,
        ...this.config.headers,
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `AIDE API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
          errorMessage = `AIDE API error: ${errorJson.error}`;
        }
      } catch {
        if (errorText) {
          errorMessage += ` - ${errorText}`;
        }
      }

      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Parse Anthropic (Claude) response to SDK content format
   */
  private parseAnthropicResponse(response: AnthropicResponse): {
    content: LanguageModelV3Content[];
    finishReason: LanguageModelV3FinishReason;
    usage: LanguageModelV3Usage;
    toolCalls: Array<{ id: string; name: string; input: string }>;
    text: string;
  } {
    const content: LanguageModelV3Content[] = [];
    const toolCalls: Array<{ id: string; name: string; input: string }> = [];
    let text = '';

    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
        content.push({
          type: 'text',
          text: block.text,
        });
      } else if (block.type === 'tool_use') {
        const inputStr = JSON.stringify(block.input);
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: inputStr,
        });
        content.push({
          type: 'tool-call',
          toolCallId: block.id,
          toolName: block.name,
          input: inputStr,
        });
      }
    }

    // Map Anthropic finish reason to SDK format
    let unifiedReason: LanguageModelV3FinishReason['unified'] = 'other';
    switch (response.stop_reason) {
      case 'end_turn':
        unifiedReason = 'stop';
        break;
      case 'max_tokens':
        unifiedReason = 'length';
        break;
      case 'tool_use':
        unifiedReason = 'tool-calls';
        break;
      case 'stop_sequence':
        unifiedReason = 'stop';
        break;
    }

    const usage: LanguageModelV3Usage = {
      inputTokens: {
        total: response.usage.input_tokens,
        noCache: response.usage.input_tokens - (response.usage.cache_read_input_tokens ?? 0),
        cacheRead: response.usage.cache_read_input_tokens,
        cacheWrite: response.usage.cache_creation_input_tokens,
      },
      outputTokens: {
        total: response.usage.output_tokens,
        text: response.usage.output_tokens,
        reasoning: undefined,
      },
    };

    return {
      content,
      finishReason: { unified: unifiedReason, raw: response.stop_reason ?? undefined },
      usage,
      toolCalls,
      text,
    };
  }

  /**
   * Parse OpenAI (GPT) response to SDK content format
   */
  private parseOpenAIResponse(response: OpenAIResponse): {
    content: LanguageModelV3Content[];
    finishReason: LanguageModelV3FinishReason;
    usage: LanguageModelV3Usage;
    toolCalls: Array<{ id: string; name: string; input: string }>;
    text: string;
  } {
    const content: LanguageModelV3Content[] = [];
    const toolCalls: Array<{ id: string; name: string; input: string }> = [];
    let text = '';

    const choice = response.choices[0];
    if (choice?.message) {
      if (choice.message.content) {
        text = choice.message.content;
        content.push({
          type: 'text',
          text: choice.message.content,
        });
      }

      if (choice.message.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          toolCalls.push({
            id: toolCall.id,
            name: toolCall.function.name,
            input: toolCall.function.arguments,
          });
          content.push({
            type: 'tool-call',
            toolCallId: toolCall.id,
            toolName: toolCall.function.name,
            input: toolCall.function.arguments,
          });
        }
      }
    }

    // Map OpenAI finish reason to SDK format
    let unifiedReason: LanguageModelV3FinishReason['unified'] = 'other';
    switch (choice?.finish_reason) {
      case 'stop':
        unifiedReason = 'stop';
        break;
      case 'length':
        unifiedReason = 'length';
        break;
      case 'content_filter':
        unifiedReason = 'content-filter';
        break;
      case 'tool_calls':
        unifiedReason = 'tool-calls';
        break;
    }

    const usage: LanguageModelV3Usage = {
      inputTokens: {
        total: response.usage.prompt_tokens,
        noCache: response.usage.prompt_tokens - (response.usage.prompt_tokens_details?.cached_tokens ?? 0),
        cacheRead: response.usage.prompt_tokens_details?.cached_tokens,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: response.usage.completion_tokens,
        text: response.usage.completion_tokens - (response.usage.completion_tokens_details?.reasoning_tokens ?? 0),
        reasoning: response.usage.completion_tokens_details?.reasoning_tokens,
      },
    };

    return {
      content,
      finishReason: { unified: unifiedReason, raw: choice?.finish_reason ?? undefined },
      usage,
      toolCalls,
      text,
    };
  }

  /**
   * Parse AIDE response based on model type
   */
  private parseAideResponse(response: AideResponseBody): {
    content: LanguageModelV3Content[];
    finishReason: LanguageModelV3FinishReason;
    usage: LanguageModelV3Usage;
    toolCalls: Array<{ id: string; name: string; input: string }>;
    text: string;
    modelId: string;
    requestId: string;
  } {
    const requestId = response.aide.request_id;

    if (this.modelInfo.type === 'anthropic' && response.aws) {
      const parsed = this.parseAnthropicResponse(response.aws);
      return {
        ...parsed,
        modelId: response.aws.model,
        requestId,
      };
    } else if (this.modelInfo.type === 'openai' && response.azure) {
      const parsed = this.parseOpenAIResponse(response.azure);
      return {
        ...parsed,
        modelId: response.azure.model,
        requestId,
      };
    }

    throw new Error('Invalid AIDE response: missing provider response data');
  }

  /**
   * Generate a response (non-streaming)
   */
  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    // Filter tools to only function tools
    const functionTools = options.tools?.filter(
      (tool): tool is LanguageModelV3FunctionTool => tool.type === 'function'
    );

    // Convert request to AIDE format
    const { body, warnings } = convertToAideRequest({
      prompt: options.prompt,
      modelInfo: this.modelInfo,
      solmaId: this.config.solmaId,
      maxTokens: options.maxOutputTokens ?? this.settings.maxTokens ?? this.modelInfo.maxTokens,
      temperature: options.temperature ?? this.settings.temperature,
      topP: options.topP,
      topK: options.topK,
      frequencyPenalty: options.frequencyPenalty,
      presencePenalty: options.presencePenalty,
      stopSequences: options.stopSequences,
      tools: functionTools,
      toolChoice: options.toolChoice,
      aideOptions: this.config.aideOptions,
    });

    // Call AIDE API
    const response = await this.callAideApi(body, options.abortSignal);

    // Parse response
    const parsed = this.parseAideResponse(response);

    return {
      content: parsed.content,
      finishReason: parsed.finishReason,
      usage: parsed.usage,
      request: { body },
      response: {
        id: parsed.requestId,
        modelId: parsed.modelId,
        body: response,
      },
      warnings: warnings.map(w => 
        w.type === 'unsupported-setting'
          ? { type: 'unsupported' as const, feature: w.message }
          : { type: 'other' as const, message: w.message }
      ),
    };
  }

  /**
   * Generate a streaming response (simulated since AIDE doesn't support streaming)
   */
  async doStream(options: LanguageModelV3CallOptions): Promise<LanguageModelV3StreamResult> {
    try {
      // Filter tools to only function tools
      const functionTools = options.tools?.filter(
        (tool): tool is LanguageModelV3FunctionTool => tool.type === 'function'
      );

      // Convert request to AIDE format
      const { body, warnings } = convertToAideRequest({
        prompt: options.prompt,
        modelInfo: this.modelInfo,
        solmaId: this.config.solmaId,
        maxTokens: options.maxOutputTokens ?? this.settings.maxTokens ?? this.modelInfo.maxTokens,
        temperature: options.temperature ?? this.settings.temperature,
        topP: options.topP,
        topK: options.topK,
        frequencyPenalty: options.frequencyPenalty,
        presencePenalty: options.presencePenalty,
        stopSequences: options.stopSequences,
        tools: functionTools,
        toolChoice: options.toolChoice,
        aideOptions: this.config.aideOptions,
      });

      // Call AIDE API (non-streaming)
      const response = await this.callAideApi(body, options.abortSignal);

      // Parse response
      const parsed = this.parseAideResponse(response);

      // Create simulated stream
      const stream = createSimulatedStream({
        text: parsed.text,
        textId: `text-${parsed.requestId}`,
        toolCalls: parsed.toolCalls,
        usage: parsed.usage,
        finishReason: parsed.finishReason,
        modelId: parsed.modelId,
        warnings,
        requestId: parsed.requestId,
      });

      return {
        stream,
        request: { body },
        response: {
          headers: {},
        },
      };
    } catch (error) {
      // Return error stream
      return {
        stream: createErrorStream(error instanceof Error ? error : new Error(String(error))),
      };
    }
  }
}

/**
 * Create an AIDE language model instance
 */
export function createAideLanguageModel(
  modelId: string,
  settings: AideModelSettings = {},
  providerSettings: AideProviderSettings = {}
): AideLanguageModel {
  // Determine auth token getter
  let getAuthToken: () => Promise<string>;
  
  if (providerSettings.getAuthToken) {
    getAuthToken = providerSettings.getAuthToken;
  } else if (providerSettings.azure) {
    getAuthToken = createTokenFetcher(providerSettings.azure);
  } else {
    getAuthToken = createTokenFetcher();
  }

  const config: AideLanguageModelConfig = {
    provider: 'aide',
    baseURL: providerSettings.baseURL ?? process.env.AIDE_BASE_URL ?? '',
    useCaseId: providerSettings.useCaseId ?? process.env.AIDE_USE_CASE_ID ?? '',
    solmaId: providerSettings.solmaId ?? process.env.AIDE_SOLMA_ID ?? '',
    getAuthToken,
    headers: providerSettings.headers,
    aideOptions: providerSettings.aideOptions,
  };

  // Validate required config
  if (!config.baseURL) {
    throw new Error('AIDE_BASE_URL is required');
  }
  if (!config.useCaseId) {
    throw new Error('AIDE_USE_CASE_ID is required');
  }
  if (!config.solmaId) {
    throw new Error('AIDE_SOLMA_ID is required');
  }

  return new AideLanguageModel(modelId, settings, config);
}
