/**
 * AIDE Provider for AI SDK
 * 
 * Custom provider for the State Farm AIDE LLM API
 * Supports both AWS Bedrock (Claude) and Azure OpenAI (GPT) models
 * 
 * @example
 * ```typescript
 * import { aide } from '@/lib/ai/providers/aide';
 * import { generateText, streamText } from 'ai';
 * 
 * // Using the default provider (reads from environment variables)
 * const model = aide('claude-sonnet-4.5');
 * 
 * // Generate text
 * const result = await generateText({
 *   model,
 *   prompt: 'Explain quantum computing',
 * });
 * 
 * // Stream text
 * const stream = await streamText({
 *   model,
 *   prompt: 'Write a story about a robot',
 * });
 * 
 * for await (const chunk of stream.textStream) {
 *   process.stdout.write(chunk);
 * }
 * ```
 * 
 * @example Custom Configuration
 * ```typescript
 * import { createAide } from '@/lib/ai/providers/aide';
 * 
 * const myAide = createAide({
 *   baseURL: 'https://aide-llm-api-prod-...',
 *   useCaseId: 'RITM1234567',
 *   solmaId: '123456',
 *   azure: {
 *     tenantId: 'your-tenant-id',
 *     clientId: 'your-client-id',
 *     clientSecret: 'your-client-secret',
 *     scope: 'your-scope',
 *   },
 * });
 * 
 * const model = myAide('gpt-4.1');
 * ```
 */

// Provider factory and default instance
export { aide, createAide, isAideModel, getAideModelIds, getAideModelDisplayNames } from './aide-provider';
export type { AideProvider, AideModelId } from './aide-provider';

// Language model class
export { AideLanguageModel, createAideLanguageModel } from './aide-language-model';

// Token fetcher utilities
export { createTokenFetcher, getAzureToken, clearTokenCache, getTokenExpiryInfo } from './aide-token-fetcher';
export type { AzureTokenConfig } from './aide-token-fetcher';

// Types
export type {
  AideProviderSettings,
  AideModelSettings,
  AideModelInfo,
  AideModelType,
  AideRequestBody,
  AideResponseBody,
  AideRequestOptions,
  AideGaasConfig,
  AideResponseMeta,
  AideResponseFilters,
  AideResponseCaller,
  AideResponseUsage,
  AideErrorResponse,
  // Anthropic types
  AnthropicMessage,
  AnthropicContent,
  AnthropicTool,
  AnthropicRequestBody,
  AnthropicResponse,
  AnthropicResponseContent,
  // OpenAI types
  OpenAIMessage,
  OpenAIContentPart,
  OpenAITool,
  OpenAIToolCall,
  OpenAIRequestBody,
  OpenAIResponse,
  OpenAIResponseChoice,
} from './aide-types';

// Model definitions
export { AIDE_MODELS } from './aide-types';
