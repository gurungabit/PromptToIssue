/**
 * Azure OAuth2 Token Fetcher
 *
 * Handles Azure AD token acquisition using client credentials flow
 * with automatic caching and refresh
 */

import type { AzureTokenResponse, CachedToken } from './aide-types';

// Token cache (in-memory)
let cachedToken: CachedToken | null = null;

// Buffer time before expiry to refresh token (5 minutes in ms)
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface AzureTokenConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  scope: string;
}

/**
 * Get Azure OAuth2 configuration from environment variables
 */
export function getAzureConfigFromEnv(): AzureTokenConfig {
  const tenantId = process.env.AIDE_AZURE_TENANT_ID;
  const clientId = process.env.AIDE_AZURE_CLIENT_ID;
  const clientSecret = process.env.AIDE_AZURE_CLIENT_SECRET;
  const scope = process.env.AIDE_AZURE_SCOPE;

  if (!tenantId || !clientId || !clientSecret || !scope) {
    throw new Error(
      'Missing Azure OAuth2 configuration. Required environment variables: ' +
        'AIDE_AZURE_TENANT_ID, AIDE_AZURE_CLIENT_ID, AIDE_AZURE_CLIENT_SECRET, AIDE_AZURE_SCOPE',
    );
  }

  return { tenantId, clientId, clientSecret, scope };
}

/**
 * Fetch a new token from Azure AD
 */
async function fetchNewToken(config: AzureTokenConfig): Promise<CachedToken> {
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: config.scope,
    grant_type: 'client_credentials',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch Azure token: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const data: AzureTokenResponse = await response.json();

  // Calculate expiry time (current time + expires_in seconds - buffer)
  const expiresAt = Date.now() + data.expires_in * 1000 - TOKEN_REFRESH_BUFFER_MS;

  return {
    token: data.access_token,
    expiresAt,
  };
}

/**
 * Check if the cached token is still valid
 */
function isTokenValid(token: CachedToken | null): boolean {
  if (!token) return false;
  return Date.now() < token.expiresAt;
}

/**
 * Create a token fetcher function with the given configuration
 * Returns a function that fetches and caches tokens
 */
export function createTokenFetcher(config?: Partial<AzureTokenConfig>): () => Promise<string> {
  // Use provided config or fall back to environment variables
  const getConfig = (): AzureTokenConfig => {
    if (config?.tenantId && config?.clientId && config?.clientSecret && config?.scope) {
      return config as AzureTokenConfig;
    }
    return getAzureConfigFromEnv();
  };

  return async (): Promise<string> => {
    // Return cached token if still valid
    if (isTokenValid(cachedToken)) {
      return cachedToken!.token;
    }

    // Fetch new token
    const fullConfig = getConfig();
    cachedToken = await fetchNewToken(fullConfig);
    return cachedToken.token;
  };
}

/**
 * Default token fetcher using environment variables
 */
export const getAzureToken = createTokenFetcher();

/**
 * Clear the token cache (useful for testing or when credentials change)
 */
export function clearTokenCache(): void {
  cachedToken = null;
}

/**
 * Get token expiry info (for debugging)
 */
export function getTokenExpiryInfo(): {
  hasToken: boolean;
  expiresAt: Date | null;
  isValid: boolean;
} {
  return {
    hasToken: cachedToken !== null,
    expiresAt: cachedToken ? new Date(cachedToken.expiresAt) : null,
    isValid: isTokenValid(cachedToken),
  };
}
