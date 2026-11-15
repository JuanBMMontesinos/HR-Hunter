import type { ApiEnvelope } from '../types/common';
import type { UserRole } from '../types/auth';
import type {
  PaginatedResult,
  UserAccount,
  UserActivityData,
} from '../types/domain';
import { apiClient } from './api';

export interface UserFilters {
  page?: number;
  limit?: number;
  role?: string;
  department?: string;
  status?: string;
  isActive?: boolean;
  search?: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  role: UserRole;
  department?: string | null;
  managerId?: number | null;
  isActive?: boolean;
  hiringDate?: string | null;
  preferredLanguage?: 'pt-BR' | 'en-US';
  isPasswordResetRequired?: boolean;
}

export type UpdateUserPayload = Partial<Omit<CreateUserPayload, 'password'>>;

export async function listUsers(
  filters: UserFilters = {},
): Promise<PaginatedResult<UserAccount>> {
  const response = await apiClient.get<ApiEnvelope<PaginatedResult<UserAccount>>>('/users', {
    params: filters,
  });
  return response.data.data;
}

export async function getUserById(id: number): Promise<UserAccount> {
  const response = await apiClient.get<ApiEnvelope<UserAccount>>(`/users/${id}`);
  return response.data.data;
}

export async function createUser(payload: CreateUserPayload): Promise<UserAccount> {
  const response = await apiClient.post<ApiEnvelope<UserAccount>>('/users', payload);
  return response.data.data;
}

export async function updateUser(
  id: number,
  payload: UpdateUserPayload,
): Promise<UserAccount> {
  const response = await apiClient.put<ApiEnvelope<UserAccount>>(`/users/${id}`, payload);
  return response.data.data;
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}

export async function getUserActivity(id: number): Promise<UserActivityData> {
  const response = await apiClient.get<ApiEnvelope<UserActivityData>>(`/users/${id}/activity`);
  return response.data.data;
}

export async function adminResetPassword(
  id: number,
  payload: {
    newPassword?: string;
    requireResetOnLogin?: boolean;
    sendEmail?: boolean;
  } = {},
): Promise<{
  message: string;
  user: UserAccount;
  requireResetOnLogin: boolean;
  temporaryPassword?: string;
}> {
  const response = await apiClient.post<
    ApiEnvelope<{
      message: string;
      user: UserAccount;
      requireResetOnLogin: boolean;
      temporaryPassword?: string;
    }>
  >(`/users/${id}/reset-password`, payload);
  return response.data.data;
}
