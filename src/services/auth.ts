/**
 * Centralized Authentication Service
 * Manages user login, session persistence in localStorage, token refresh, and logout.
 * Implements automated background token refresh to guarantee sessions survive > 30 minutes.
 */

import {
  apiClient,
  setStoredTokens,
  clearStoredAuth,
  getStoredAccessToken,
  refreshSession,
} from './api';
import { LoginResponse, User } from '../types/api';

let refreshTimer: ReturnType<typeof setInterval> | null = null;

export async function loginUser(
  email: string,
  password: string
): Promise<LoginResponse> {
  const response = await apiClient<LoginResponse>('/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ email, password }),
  });

  setStoredTokens(
    response.access_token,
    response.refresh_token,
    response.expires_in || 900
  );
  localStorage.setItem('ivy_user', JSON.stringify(response.user));

  setupAutoRefresh();
  return response;
}

export async function logoutUser(): Promise<void> {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  try {
    // Attempt graceful server-side invalidation
    await apiClient('/auth/logout', {
      method: 'POST',
    });
  } catch (err) {
    console.warn('Server logout notice:', err);
  } finally {
    clearStoredAuth();
  }
}

export function getCurrentUser(): User | null {
  const userStr = localStorage.getItem('ivy_user');
  if (!userStr) return null;
  try {
    const u = JSON.parse(userStr);
    if (u && !u.name && u.email) {
      u.name = u.email.split('@')[0];
    }
    return u;
  } catch {
    return null;
  }
}

export function isSessionActive(): boolean {
  return !!getStoredAccessToken() && !!getCurrentUser();
}

/**
 * Setup proactive background refresh interval.
 * Tokens expire in 15 minutes (900s). This interval checks every 60 seconds
 * and refreshes the token whenever less than 3 minutes remain.
 * This guarantees the user's session remains alive well past 30 minutes!
 */
export function setupAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  refreshTimer = setInterval(async () => {
    const expiresAtStr = localStorage.getItem('ivy_token_expires_at');
    if (!expiresAtStr) return;

    const expiresAt = parseInt(expiresAtStr, 10);
    const timeRemainingMs = expiresAt - Date.now();

    // If less than 3 minutes (180,000 ms) remain, refresh proactively
    if (timeRemainingMs < 180000 && timeRemainingMs > 0) {
      console.info('Auto-refreshing session token before 15m expiration...');
      await refreshSession();
    }
  }, 60000);
}
