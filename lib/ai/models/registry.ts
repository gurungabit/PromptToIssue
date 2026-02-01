import { google } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { ollama } from 'ai-sdk-ollama';
// Uncomment these when adding more providers
// import { openai } from '@ai-sdk/openai';
// import { anthropic } from '@ai-sdk/anthropic';
import { getModelConfig, type ModelConfig } from './config';
import type { LanguageModel } from 'ai';

// Create OpenRouter client using OpenAI Compatible SDK
const openrouter = createOpenAICompatible({
  name: 'openrouter',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

/**
 * Creates a provider instance for the given model configuration
 */
function createProviderInstance(config: ModelConfig): LanguageModel {
  switch (config.provider) {
    case 'google':
      return google(config.modelId);
    case 'openrouter':
      return openrouter(config.modelId);
    case 'ollama':
      return ollama(config.modelId);
    // case 'openai':
    //   return openai(config.modelId);
    // case 'anthropic':
    //   return anthropic(config.modelId);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

/**
 * Gets a language model instance by model ID
 * @throws Error if model is not found or not enabled
 */
export function getModel(modelId: string): LanguageModel {
  const config = getModelConfig(modelId);
  
  if (!config) {
    throw new Error(`Model "${modelId}" not found or not enabled`);
  }
  
  return createProviderInstance(config);
}

/**
 * Gets the default model (first enabled model)
 */
export function getDefaultModel(): { model: LanguageModel; config: ModelConfig } {
  const config = getModelConfig('gemini-3-flash');
  
  if (!config) {
    throw new Error('No default model configured');
  }
  
  return {
    model: createProviderInstance(config),
    config,
  };
}
