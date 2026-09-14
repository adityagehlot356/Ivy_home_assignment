/**
 * Centralized Resilient API Client
 * Built on verified live API behaviors:
 * 1. Requires dual headers: X-API-Key and Authorization: Bearer <access_token>
 * 2. Handles 15-minute token expiration with transparent refresh via POST /auth/refresh
 * 3. Centralized error extraction and network resilience
 */

const DEFAULT_BASE_URL = 'https://solve.ivy.homes';

export function getBaseUrl(): string {
  return (import.meta as any).env?.VITE_API_BASE_URL || DEFAULT_BASE_URL;
}

export function getStoredApiKey(): string {
  return (
    (import.meta as any).env?.VITE_API_KEY ||
    localStorage.getItem('ivy_api_key') ||
    ''
  );
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem('ivy_api_key', key.trim());
}

export function getStoredAccessToken(): string | null {
  return localStorage.getItem('ivy_access_token');
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem('ivy_refresh_token');
}

export function setStoredTokens(accessToken: string, refreshToken?: string, expiresIn?: number): void {
  localStorage.setItem('ivy_access_token', accessToken);
  if (refreshToken) {
    localStorage.setItem('ivy_refresh_token', refreshToken);
  }
  if (expiresIn) {
    const expiresAt = Date.now() + expiresIn * 1000;
    localStorage.setItem('ivy_token_expires_at', expiresAt.toString());
  }
}

export function clearStoredAuth(): void {
  localStorage.removeItem('ivy_access_token');
  localStorage.removeItem('ivy_refresh_token');
  localStorage.removeItem('ivy_token_expires_at');
  localStorage.removeItem('ivy_user');
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

/**
 * Execute silent token refresh using the verified /auth/refresh endpoint
 */
export async function refreshSession(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  const apiKey = getStoredApiKey();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${getBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'X-API-Key': apiKey } : {}),
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      clearStoredAuth();
      return null;
    }

    const data = await res.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token || refreshToken;
    setStoredTokens(newAccessToken, newRefreshToken, data.expires_in || 900);
    return newAccessToken;
  } catch (err) {
    console.error('Session refresh failed:', err);
    return null;
  }
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Core apiClient wrapper with auto dual-header injection and automatic refresh interceptor
 */
export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = getBaseUrl();
  const apiKey = getStoredApiKey();
  const accessToken = getStoredAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  if (!options.skipAuth && accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized by attempting a single transparent refresh
  if (response.status === 401 && !options.skipAuth && getStoredRefreshToken()) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshSession();
      isRefreshing = false;

      if (newToken) {
        onRefreshed(newToken);
      } else {
        refreshSubscribers = [];
        const errData = await response.json().catch(() => ({ detail: 'Session expired' }));
        throw new Error(errData.detail || 'Session expired, please log in again.');
      }
    }

    // Wait for the token to refresh and retry request
    const retryPromise = new Promise<T>((resolve, reject) => {
      subscribeTokenRefresh(async (newToken) => {
        try {
          headers['Authorization'] = `Bearer ${newToken}`;
          const retryRes = await fetch(url, { ...options, headers });
          if (!retryRes.ok) {
            const errData = await retryRes.json().catch(() => ({ detail: retryRes.statusText }));
            reject(new Error(errData.detail || `Request failed with status ${retryRes.status}`));
            return;
          }
          const retryData = await retryRes.json();
          resolve(retryData as T);
        } catch (e) {
          reject(e);
        }
      });
    });

    return retryPromise;
  }

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson.detail) {
        errorMsg = errJson.detail;
      }
    } catch {
      // ignore non-json error
    }
    throw new Error(errorMsg);
  }

  return (await response.json()) as T;
}
