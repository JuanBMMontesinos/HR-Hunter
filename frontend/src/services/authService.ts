import type {
  AuthSessionData,
  LoginPayload,
  PermissionKey,
  PermissionsResponseData,
  UserDto,
} from '../types/auth';
import type { ApiEnvelope } from '../types/common';
import { apiClient } from './api';

export async function loginApi(payload: LoginPayload): Promise<AuthSessionData> {
  const response = await apiClient.post<ApiEnvelope<AuthSessionData>>('/auth/login', payload);
  return response.data.data;
}

export async function refreshSessionApi(): Promise<AuthSessionData> {
  const response = await apiClient.post<ApiEnvelope<AuthSessionData>>('/auth/refresh-token');
  return response.data.data;
}

export async function logoutApi(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function forgotPasswordApi(email: string): Promise<{ message: string }> {
  const response = await apiClient.post<ApiEnvelope<{ message: string }>>(
    '/auth/forgot-password',
    { email },
  );
  return response.data.data;
}

export async function resetPasswordApi(
  token: string,
  newPassword: string,
): Promise<{ message: string }> {
  const response = await apiClient.post<ApiEnvelope<{ message: string }>>(
    '/auth/reset-password',
    { token, newPassword },
  );
  return response.data.data;
}

export async function getPermissionsApi(): Promise<PermissionsResponseData> {
  const response = await apiClient.get<ApiEnvelope<PermissionsResponseData>>('/auth/permissions');
  return response.data.data;
}

export async function getMeApi(): Promise<{ user: UserDto; permissions: PermissionKey[] }> {
  const response = await apiClient.get<ApiEnvelope<{ user: UserDto; permissions: PermissionKey[] }>>(
    '/auth/me',
  );
  return response.data.data;
}

/**
 * Decodes JWT `exp` (in epoch milliseconds) without validating signature client-side.
 * Used solely to schedule proactive silent token refreshes prior to expiration.
 */
export function decodeJwtExpiryMs(token: string | null | undefined): number | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json) as { exp?: unknown };
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      return payload.exp * 1000;
    }
    return null;
  } catch {
    return null;
  }
}
