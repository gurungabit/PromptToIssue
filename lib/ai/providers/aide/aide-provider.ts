/**
 * AIDE Provider
 *
 * Factory function for creating AIDE provider instances
 * Compatible with the AI SDK provider pattern
 */

import type { LanguageModelV3 } from '@ai-sdk/provider';
import type { AideProviderSettings, AideModelSettings, AideModelInfo } from './aide-types';
import { AIDE_MODELS } from './aide-types';
import { AideLanguageModel, createAideLanguageModel } from './aide-language-model';

// =============================================================================
// Provider Interface
// =============================================================================

export interface AideProvider {
  /**
   * Creates an AIDE language model
   * @param modelId - The model ID (e.g., 'claude-sonnet-4.5', 'gpt-4.1')
   * @param settings - Optional model-specific settings
   */
  (modelId: AideModelId | string, settings?: AideModelSettings): AideLanguageModel;

  /**
   * Creates an AIDE language model
   * @param modelId - The model ID
   * @param settings - Optional model-specific settings
   */
  languageModel(modelId: AideModelId | string, settings?: AideModelSettings): AideLanguageModel;

  /**
   * Returns the provider name
   */
  readonly provider: string;

  /**
   * Returns available model IDs
   */
  readonly models: AideModelId[];

  /**
   * Returns model information for a given model ID
   */
  getModelInfo(modelId: string): AideModelInfo | undefined;
}

/**
 * Available AIDE model IDs
 */
export type AideModelId = keyof typeof AIDE_MODELS;

// =============================================================================
// Provider Factory
// =============================================================================

/**
 * Create an AIDE provider instance with custom configuration
 *
 * @example
 * ```typescript
 * const myAide = createAide({
 *   baseURL: 'https://aide-llm-api-prod...',
 *   useCaseId: 'RITM1234567',
 *   solmaId: '123456',
 * });
 *
 * const model = myAide('claude-sonnet-4.5');
 * ```
 */
export function createAide(options: AideProviderSettings = {}): AideProvider {
  const createModel = (
    modelId: AideModelId | string,
    settings: AideModelSettings = {},
  ): AideLanguageModel => {
    return createAideLanguageModel(modelId, settings, options);
  };

  const provider = function (
    modelId: AideModelId | string,
    settings?: AideModelSettings,
  ): AideLanguageModel {
    if (new.target) {
      throw new Error('The AIDE model factory function cannot be called with the new keyword.');
    }
    return createModel(modelId, settings ?? {});
  } as AideProvider;

  // Add languageModel method
  provider.languageModel = createModel;

  // Add provider name
  Object.defineProperty(provider, 'provider', {
    value: 'aide',
    enumerable: true,
  });

  // Add available models
  Object.defineProperty(provider, 'models', {
    value: Object.keys(AIDE_MODELS) as AideModelId[],
    enumerable: true,
  });

  // Add getModelInfo method
  provider.getModelInfo = (modelId: string): AideModelInfo | undefined => {
    return AIDE_MODELS[modelId];
  };

  return provider;
}

// =============================================================================
// Default Provider Instance
// =============================================================================

/**
 * Default AIDE provider instance using environment variables
 *
 * Required environment variables:
 * - AIDE_BASE_URL: Base URL for the AIDE API
 * - AIDE_USE_CASE_ID: Your AIDE use case ID (RITM* or BUSN*)
 * - AIDE_SOLMA_ID: Your SOLMA ID
 * - AIDE_AZURE_TENANT_ID: Azure AD tenant ID
 * - AIDE_AZURE_CLIENT_ID: Azure AD client ID
 * - AIDE_AZURE_CLIENT_SECRET: Azure AD client secret
 * - AIDE_AZURE_SCOPE: Azure AD scope
 *
 * @example
 * ```typescript
 * import { aide } from '@/lib/ai/providers/aide';
 *
 * const model = aide('claude-sonnet-4.5');
 *
 * const result = await generateText({
 *   model,
 *   prompt: 'Hello, world!',
 * });
 * ```
 */
export const aide: AideProvider = createAide();

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if a model ID is a valid AIDE model
 */
export function isAideModel(modelId: string): modelId is AideModelId {
  return modelId in AIDE_MODELS;
}

/**
 * Get all available AIDE model IDs
 */
export function getAideModelIds(): AideModelId[] {
  return Object.keys(AIDE_MODELS) as AideModelId[];
}

/**
 * Get model display names for UI
 */
export function getAideModelDisplayNames(): Record<AideModelId, string> {
  const result: Record<string, string> = {};
  for (const [id, info] of Object.entries(AIDE_MODELS)) {
    result[id] = info.displayName;
  }
  return result as Record<AideModelId, string>;
}
