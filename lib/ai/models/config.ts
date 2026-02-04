import { z } from 'zod';

// Model provider schema
export const ModelProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'openrouter',
  'ollama',
  'aide',
]);
export type ModelProvider = z.infer<typeof ModelProviderSchema>;

// Model configuration schema
export const ModelConfigSchema = z.object({
  id: z.string(),
  provider: ModelProviderSchema,
  modelId: z.string(),
  enabled: z.boolean(),
  displayName: z.string(),
  description: z.string().optional(),
  defaultParams: z.object({
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().positive(),
  }),
  systemPrompt: z.string().optional(),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

// Available models configuration
// Add/remove models here - no code changes needed elsewhere
export const MODELS: ModelConfig[] = [
  // AIDE Models (State Farm internal LLM API)
  {
    id: 'aide-claude-sonnet-4.5',
    provider: 'aide',
    modelId: 'claude-sonnet-4.5',
    enabled: true,
    displayName: 'Claude Sonnet 4.5 (AIDE)',
    description: 'Latest Claude Sonnet via State Farm AIDE API',
    defaultParams: {
      temperature: 0.7,
      maxTokens: 8192,
    },
  },
  {
    id: 'aide-claude-haiku-4.5',
    provider: 'aide',
    modelId: 'claude-haiku-4.5',
    enabled: true,
    displayName: 'Claude Haiku 4.5 (AIDE)',
    description: 'Fast Claude Haiku via State Farm AIDE API',
    defaultParams: {
      temperature: 0.7,
      maxTokens: 8192,
    },
  },
  {
    id: 'aide-gpt-4.1',
    provider: 'aide',
    modelId: 'gpt-4.1',
    enabled: true,
    displayName: 'GPT 4.1 (AIDE)',
    description: 'GPT 4.1 via State Farm AIDE API',
    defaultParams: {
      temperature: 0.7,
      maxTokens: 4096,
    },
  },
  // Other providers
  {
    id: 'qwen3-8b',
    provider: 'ollama',
    modelId: 'qwen3:8b',
    enabled: true,
    displayName: 'Qwen3 8B (Ollama)',
    description: 'Local Qwen3 8B model via Ollama',
    defaultParams: {
      temperature: 0.7,
      maxTokens: 4096,
    },
  },
  {
    id: 'gemini-3-flash',
    provider: 'google',
    modelId: 'gemini-3-flash-preview',
    enabled: true,
    displayName: 'Gemini 3 Flash',
    description: 'Fast and capable Google model',
    defaultParams: {
      temperature: 0.7,
      maxTokens: 8192,
    },
  },
  {
    id: 'gemini-2.5-flash',
    provider: 'google',
    modelId: 'gemini-2.5-flash',
    enabled: true,
    displayName: 'Gemini 2.5 Flash',
    description: 'Latest stable flash model',
    defaultParams: {
      temperature: 0.7,
      maxTokens: 8192,
    },
  },
  {
    id: 'gemini-2-flash',
    provider: 'google',
    modelId: 'gemini-2.0-flash',
    enabled: true,
    displayName: 'Gemini 2 Flash',
    description: 'Previous generation fast model',
    defaultParams: {
      temperature: 0.7,
      maxTokens: 8192,
    },
  },
  {
    id: 'gpt-oss-120b',
    provider: 'openrouter',
    modelId: 'openai/gpt-oss-120b:free',
    enabled: true,
    displayName: 'GPT-OSS 120B',
    description: 'Free open source GPT model via OpenRouter',
    defaultParams: {
      temperature: 0.7,
      maxTokens: 4096,
    },
  },
  // Uncomment and add API keys to enable these models
  // {
  //   id: 'gpt-4o',
  //   provider: 'openai',
  //   modelId: 'gpt-4o',
  //   enabled: false,
  //   displayName: 'GPT-4o',
  //   description: 'Most capable OpenAI model',
  //   defaultParams: {
  //     temperature: 0.7,
  //     maxTokens: 4096,
  //   },
  // },
  // {
  //   id: 'claude-sonnet',
  //   provider: 'anthropic',
  //   modelId: 'claude-sonnet-4-20250514',
  //   enabled: false,
  //   displayName: 'Claude Sonnet 4',
  //   description: 'Balanced performance and cost',
  //   defaultParams: {
  //     temperature: 0.7,
  //     maxTokens: 4096,
  //   },
  // },
];

// Get enabled models only
export function getEnabledModels(): ModelConfig[] {
  return MODELS.filter((model) => model.enabled);
}

// Get model by ID
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODELS.find((model) => model.id === modelId && model.enabled);
}

// Validate model configuration at runtime
export function validateModels(): void {
  for (const model of MODELS) {
    const result = ModelConfigSchema.safeParse(model);
    if (!result.success) {
      throw new Error(`Invalid model config for ${model.id}: ${result.error.message}`);
    }
  }
}
