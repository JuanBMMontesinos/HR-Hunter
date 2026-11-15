import type { ApiEnvelope } from '../types/common';
import type {
  AuditLogEntry,
  BackupSnapshotResult,
  EmailTemplate,
  LoginHistoryEntry,
  PaginatedResult,
  StageFunnel,
  StageTemplate,
  SystemConfigData,
} from '../types/domain';
import { apiClient } from './api';

export async function getSystemSettings(): Promise<SystemConfigData> {
  const response = await apiClient.get<ApiEnvelope<SystemConfigData>>('/settings');
  return response.data.data;
}

export async function updateSystemSettings(
  configs: Array<{
    configKey: string;
    configValue: string;
    dataType?: string;
    category?: string;
    isSensitive?: boolean;
  }>,
): Promise<SystemConfigData> {
  const response = await apiClient.put<ApiEnvelope<SystemConfigData>>('/settings', { configs });
  return response.data.data;
}

export async function listStageTemplates(): Promise<StageTemplate[]> {
  const response = await apiClient.get<ApiEnvelope<StageTemplate[]>>('/settings/stages');
  return response.data.data;
}

export async function createStageTemplate(
  payload: Omit<StageTemplate, 'id'>,
): Promise<StageTemplate> {
  const response = await apiClient.post<ApiEnvelope<StageTemplate>>('/settings/stages', payload);
  return response.data.data;
}

export async function updateStageTemplate(
  id: number,
  payload: Partial<Omit<StageTemplate, 'id'>>,
): Promise<StageTemplate> {
  const response = await apiClient.put<ApiEnvelope<StageTemplate>>(`/settings/stages/${id}`, payload);
  return response.data.data;
}

export async function deleteStageTemplate(id: number): Promise<void> {
  await apiClient.delete(`/settings/stages/${id}`);
}

export async function listFunnels(): Promise<StageFunnel[]> {
  const response = await apiClient.get<ApiEnvelope<StageFunnel[]>>('/settings/funnels');
  return response.data.data;
}

export async function createFunnel(payload: {
  name: string;
  description?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  items: Array<{ stageId: number; stageOrder: number }>;
}): Promise<StageFunnel> {
  const response = await apiClient.post<ApiEnvelope<StageFunnel>>('/settings/funnels', payload);
  return response.data.data;
}

export async function updateFunnel(
  id: number,
  payload: Partial<{
    name: string;
    description?: string | null;
    isActive?: boolean;
    isDefault?: boolean;
    items: Array<{ stageId: number; stageOrder: number }>;
  }>,
): Promise<StageFunnel> {
  const response = await apiClient.put<ApiEnvelope<StageFunnel>>(`/settings/funnels/${id}`, payload);
  return response.data.data;
}

export async function deleteFunnel(id: number): Promise<void> {
  await apiClient.delete(`/settings/funnels/${id}`);
}

export async function listEmailTemplates(): Promise<EmailTemplate[]> {
  const response = await apiClient.get<ApiEnvelope<EmailTemplate[]>>('/settings/email-templates');
  return response.data.data;
}

export async function createEmailTemplate(
  payload: Omit<EmailTemplate, 'id' | 'isSystem'>,
): Promise<EmailTemplate> {
  const response = await apiClient.post<ApiEnvelope<EmailTemplate>>(
    '/settings/email-templates',
    payload,
  );
  return response.data.data;
}

export async function updateEmailTemplate(
  id: number,
  payload: Partial<Omit<EmailTemplate, 'id' | 'isSystem'>>,
): Promise<EmailTemplate> {
  const response = await apiClient.put<ApiEnvelope<EmailTemplate>>(
    `/settings/email-templates/${id}`,
    payload,
  );
  return response.data.data;
}

export async function deleteEmailTemplate(id: number): Promise<void> {
  await apiClient.delete(`/settings/email-templates/${id}`);
}

export async function sendTestEmail(payload: {
  to: string;
  templateKey?: string;
  variables?: Record<string, string>;
}): Promise<{ to: string; subject: string; simulated?: boolean; sent?: boolean }> {
  const response = await apiClient.post<
    ApiEnvelope<{ to: string; subject: string; simulated?: boolean; sent?: boolean }>
  >('/settings/email-test', payload);
  return response.data.data;
}

export async function listAuditLog(params: {
  page?: number;
  limit?: number;
  userId?: number;
  action?: string;
  tableName?: string;
  startDate?: string;
  endDate?: string;
} = {}): Promise<PaginatedResult<AuditLogEntry>> {
  const response = await apiClient.get<ApiEnvelope<PaginatedResult<AuditLogEntry>>>(
    '/settings/audit-log',
    { params },
  );
  return response.data.data;
}

export async function listLoginHistory(params: {
  page?: number;
  limit?: number;
  userId?: number;
  isSuccessful?: boolean;
  email?: string;
  startDate?: string;
  endDate?: string;
} = {}): Promise<PaginatedResult<LoginHistoryEntry>> {
  const response = await apiClient.get<ApiEnvelope<PaginatedResult<LoginHistoryEntry>>>(
    '/settings/login-history',
    { params },
  );
  return response.data.data;
}

export async function generateBackupSnapshot(
  format: 'json' | 'sql' = 'json',
): Promise<BackupSnapshotResult> {
  const response = await apiClient.post<ApiEnvelope<BackupSnapshotResult>>('/settings/backup', {
    format,
  });
  return response.data.data;
}
