/**
 * AIDE LLM API Types
 *
 * Type definitions for the State Farm AIDE LLM API
 * Supports both AWS Bedrock (Claude) and Azure OpenAI (GPT) models
 */

// =============================================================================
// Provider Configuration
// =============================================================================

export interface AideProviderSettings {
  /**
   * Base URL for the AIDE API
   * @default process.env.AIDE_BASE_URL
   */
  baseURL?: string;

  /**
   * Use Case ID for AIDE API authentication
   * Format: "RITM*******" or "BUSN*******"
   * @default process.env.AIDE_USE_CASE_ID
   */
  useCaseId?: string;

  /**
   * SOLMA ID for logging metadata
   * @default process.env.AIDE_SOLMA_ID
   */
  solmaId?: string;

  /**
   * Azure OAuth2 configuration for token fetching
   */
  azure?: {
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    scope?: string;
  };

  /**
   * Custom function to get auth token (overrides Azure OAuth2)
   */
  getAuthToken?: () => Promise<string>;

  /**
   * Additional headers to include in requests
   */
  headers?: Record<string, string>;

  /**
   * AIDE-specific options
   */
  aideOptions?: {
    scrubInput?: boolean;
    applyGuardrail?: boolean;
    failOnScrub?: boolean;
  };
}

export interface AideModelSettings {
  /**
   * Override temperature for this model
   */
  temperature?: number;

  /**
   * Override max tokens for this model
   */
  maxTokens?: number;
}

// =============================================================================
// Model Types
// =============================================================================

export type AideModelType = 'anthropic' | 'openai';

export interface AideModelInfo {
  type: AideModelType;
  aideModelId: string;
  displayName: string;
  maxTokens: number;
  supportsTools: boolean;
  supportsVision: boolean;
}

/**
 * Mapping of model IDs to their AIDE configuration
 */
export const AIDE_MODELS: Record<string, AideModelInfo> = {
  'claude-sonnet-4.5': {
    type: 'anthropic',
    aideModelId: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    displayName: 'Claude Sonnet 4.5',
    maxTokens: 8192,
    supportsTools: true,
    supportsVision: true,
  },
  'claude-haiku-4.5': {
    type: 'anthropic',
    aideModelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
    displayName: 'Claude Haiku 4.5',
    maxTokens: 8192,
    supportsTools: true,
    supportsVision: true,
  },
  'gpt-4.1': {
    type: 'openai',
    aideModelId: 'gpt-4.1',
    displayName: 'GPT 4.1',
    maxTokens: 4096,
    supportsTools: true,
    supportsVision: true,
  },
};

// =============================================================================
// AIDE API Request Types
// =============================================================================

export interface AideRequestOptions {
  scrub_input: boolean;
  apply_guardrail: boolean;
  fail_on_scrub: boolean;
}

export interface AideGaasConfig {
  guardrailsEnabled: boolean;
  scrubInput: boolean;
  scrubbingTimeoutSeconds: number;
  pathToPrompt: string;
  logMetadata: {
    solmaId: string;
  };
}

// Anthropic (Claude) message format
export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: AnthropicContent[];
}

export type AnthropicContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string | AnthropicContent[] };

export interface AnthropicTool {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicRequestBody {
  anthropic_version: string;
  max_tokens: number;
  system?: string;
  messages: AnthropicMessage[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  tools?: AnthropicTool[];
  tool_choice?: { type: 'auto' | 'any' | 'tool'; name?: string };
}

// OpenAI (GPT) message format
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | OpenAIContentPart[] | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
    strict?: boolean;
  };
}

export interface OpenAIRequestBody {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  tools?: OpenAITool[];
  tool_choice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } };
}

// Full AIDE request body
export interface AideRequestBody {
  aide: AideRequestOptions;
  gaas: AideGaasConfig;
  aws?: {
    bedrock: {
      invoke: {
        modelId: string;
        body: AnthropicRequestBody;
      };
    };
  };
  azure?: {
    openai: {
      apiVersion: string;
      chatCompletions: {
        create: OpenAIRequestBody;
      };
    };
  };
}

// =============================================================================
// AIDE API Response Types
// =============================================================================

export interface AideResponseFilters {
  scrub?: {
    executed: boolean;
    violation: boolean;
    details: {
      scrubbed: string[];
    };
  };
  guardrail?: {
    executed: boolean;
    violation: boolean;
    details: Record<string, unknown>;
  };
  openai?: {
    executed: boolean;
    violation: boolean;
    details: Record<string, unknown>;
  };
}

export interface AideResponseCaller {
  application_id: string;
  solma_id: string;
  use_case: string;
  use_case_id: string;
}

export interface AideResponseUsage {
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  input_token_cost: number;
  output_token_cost: number;
}

export interface AideResponseMeta {
  request_id: string;
  trace_id: string;
  filters: AideResponseFilters;
  caller: AideResponseCaller;
  usage: AideResponseUsage;
}

// Anthropic response content
export type AnthropicResponseContent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown };

export interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: AnthropicResponseContent[];
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

// OpenAI response
export interface OpenAIResponseChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: OpenAIToolCall[];
    refusal?: string | null;
  };
  finish_reason: 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;
  logprobs?: unknown;
}

export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIResponseChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    completion_tokens_details?: {
      reasoning_tokens?: number;
      accepted_prediction_tokens?: number;
      rejected_prediction_tokens?: number;
    };
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
  };
  system_fingerprint?: string;
}

// Full AIDE response body
export interface AideResponseBody {
  aide: AideResponseMeta;
  gaas: {
    scrubbingRuleViolation: boolean;
  };
  aws?: AnthropicResponse;
  azure?: OpenAIResponse;
}

// Error response
export interface AideErrorResponse {
  request_id: string;
  error: string;
}

// =============================================================================
// Token Types
// =============================================================================

export interface AzureTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  ext_expires_in?: number;
}

export interface CachedToken {
  token: string;
  expiresAt: number;
}
