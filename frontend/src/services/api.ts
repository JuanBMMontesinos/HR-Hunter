import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { NotificationsListData } from '../types/auth';
import type { ApiEnvelope, ApiErrorEnvelope, ParsedApiError } from '../types/common';

export interface HealthData {
  status: 'ok' | 'degraded';
  service: string;
  database: 'connected' | 'disconnected';
  latencyMs: number;
}

export interface HealthResponse {
  success: boolean;
  data: HealthData;
  timestamp: string;
}

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface AuthInterceptorHandlers {
  getToken: () => string | null;
  refreshSession: () => Promise<string | null>;
  onAuthFailure: () => void;
}

const SKIP_REFRESH_PATHS = [
  '/auth/login',
  '/auth/refresh-token',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/logout',
];

let authHandlers: AuthInterceptorHandlers = {
  getToken: () => null,
  refreshSession: async () => null,
  onAuthFailure: () => {},
};

let inFlightRefresh: Promise<string | null> | null = null;

const resolvedBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || '/api/v1';

export const apiClient = axios.create({
  baseURL: resolvedBaseUrl,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function registerAuthInterceptors(handlers: AuthInterceptorHandlers): void {
  authHandlers = handlers;
}

function shouldSkipRefresh(url?: string): boolean {
  if (!url) return false;
  return SKIP_REFRESH_PATHS.some((path) => url.includes(path));
}

function getSingleFlightRefresh(): Promise<string | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = authHandlers
      .refreshSession()
      .catch(() => null)
      .finally(() => {
        inFlightRefresh = null;
      });
  }
  return inFlightRefresh;
}

apiClient.interceptors.request.use((config) => {
  const token = authHandlers.getToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorEnvelope>) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;

    if (
      !originalRequest ||
      status !== 401 ||
      originalRequest._retry ||
      shouldSkipRefresh(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const newToken = await getSingleFlightRefresh();

    if (!newToken) {
      authHandlers.onAuthFailure();
      return Promise.reject(error);
    }

    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    return apiClient(originalRequest);
  },
);

export function parseApiError(error: unknown): ParsedApiError {
  if (axios.isAxiosError<ApiErrorEnvelope>(error)) {
    const status = error.response?.status ?? 0;
    const apiError = error.response?.data?.error;
    if (apiError && typeof apiError === 'object') {
      return {
        status,
        code: apiError.code || 'API_ERROR',
        message: apiError.message || error.message || 'Request failed',
        details: apiError.details,
      };
    }

    return {
      status,
      code: error.code || 'NETWORK_ERROR',
      message: error.message || 'Network error',
    };
  }

  if (error instanceof Error) {
    return {
      status: 0,
      code: 'UNKNOWN_ERROR',
      message: error.message,
    };
  }

  return {
    status: 0,
    code: 'UNKNOWN_ERROR',
    message: 'Unexpected error',
  };
}

export async function fetchHealthStatus(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health');
  return response.data;
}

export async function fetchNotifications(
  params?: { unreadOnly?: boolean; page?: number; limit?: number },
): Promise<NotificationsListData> {
  const response = await apiClient.get<ApiEnvelope<NotificationsListData>>('/notifications', {
    params,
  });
  return response.data.data;
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiClient.put(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.put('/notifications/read-all');
}
