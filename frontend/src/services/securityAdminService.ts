import type { ApiEnvelope } from '../types/common';
import type { UserRole } from '../types/auth';
import type {
  AuditLogEntry,
  PaginatedResult,
  PermissionsMatrixData,
  RetentionExecutionLog,
  RetentionExecutionResult,
  RetentionPolicy,
  SecurityAlert,
  SecurityAlertStatus,
  SecurityReport,
  SecurityStats,
} from '../types/domain';
import { triggerBlobDownload } from '../utils/formatters';
import { apiClient } from './api';

export async function getPermissionsMatrix(): Promise<PermissionsMatrixData> {
  const response = await apiClient.get<ApiEnvelope<PermissionsMatrixData>>('/permissions/matrix');
  return response.data.data;
}

export async function updateRolePermissions(
  role: UserRole,
  permissionIds: number[],
): Promise<{ role: UserRole; permissionIds: number[] }> {
  const response = await apiClient.put<ApiEnvelope<{ role: UserRole; permissionIds: number[] }>>(
    `/permissions/roles/${encodeURIComponent(role)}`,
    { permissionIds },
  );
  return response.data.data;
}

export async function listPermissionAuditLog(
  params: { page?: number; limit?: number } = {},
): Promise<PaginatedResult<AuditLogEntry>> {
  const response = await apiClient.get<ApiEnvelope<PaginatedResult<AuditLogEntry>>>(
    '/permissions/audit-log',
    { params },
  );
  return response.data.data;
}

export async function listSecurityAlerts(params: {
  status?: string;
  severity?: string;
  alertType?: string;
  page?: number;
  limit?: number;
} = {}): Promise<PaginatedResult<SecurityAlert>> {
  const response = await apiClient.get<ApiEnvelope<PaginatedResult<SecurityAlert>>>(
    '/security-alerts',
    { params },
  );
  return response.data.data;
}

export async function getSecurityStats(): Promise<SecurityStats> {
  const response = await apiClient.get<ApiEnvelope<SecurityStats>>('/security-alerts/stats');
  return response.data.data;
}

export async function resolveSecurityAlert(
  id: number,
  payload: {
    status: Exclude<SecurityAlertStatus, 'ACTIVE'>;
    resolutionNote?: string;
  },
): Promise<SecurityAlert> {
  const response = await apiClient.put<ApiEnvelope<SecurityAlert>>(
    `/security-alerts/${id}/resolve`,
    payload,
  );
  return response.data.data;
}

export async function generateSecurityReport(
  payload: { periodStart?: string | null; periodEnd?: string | null } = {},
): Promise<SecurityReport> {
  const response = await apiClient.post<ApiEnvelope<SecurityReport>>(
    '/analytics/generate-report',
    payload,
  );
  return response.data.data;
}

export async function listSecurityReports(
  params: { page?: number; limit?: number } = {},
): Promise<PaginatedResult<SecurityReport>> {
  const response = await apiClient.get<ApiEnvelope<PaginatedResult<SecurityReport>>>(
    '/analytics/reports',
    { params },
  );
  return response.data.data;
}

export async function listRetentionPolicies(): Promise<RetentionPolicy[]> {
  const response = await apiClient.get<
    ApiEnvelope<RetentionPolicy[] | { items: RetentionPolicy[] }>
  >('/retention/policies');
  const raw = response.data.data;
  if (Array.isArray(raw)) return raw;
  return Array.isArray(raw?.items) ? raw.items : [];
}

export async function updateRetentionPolicy(
  key: string,
  days: number,
): Promise<RetentionPolicy> {
  const response = await apiClient.put<ApiEnvelope<RetentionPolicy>>(
    `/retention/policies/${encodeURIComponent(key)}`,
    { days },
  );
  return response.data.data;
}

export async function executeRetention(dryRun: boolean): Promise<RetentionExecutionResult> {
  const response = await apiClient.post<ApiEnvelope<RetentionExecutionResult>>(
    '/retention/execute',
    { dryRun },
  );
  return response.data.data;
}

export async function listRetentionHistory(
  params: { page?: number; limit?: number } = {},
): Promise<PaginatedResult<RetentionExecutionLog>> {
  const response = await apiClient.get<ApiEnvelope<PaginatedResult<RetentionExecutionLog>>>(
    '/retention/history',
    { params },
  );
  return response.data.data;
}

export async function downloadSecurityExport(
  kind: 'unauthorized-csv' | 'unauthorized-pdf' | 'alerts-csv',
): Promise<void> {
  const endpointMap = {
    'unauthorized-csv': {
      url: '/exports/unauthorized-access-logs/csv',
      filename: `unauthorized-access-${Date.now()}.csv`,
    },
    'unauthorized-pdf': {
      url: '/exports/unauthorized-access-logs/pdf',
      filename: `unauthorized-access-${Date.now()}.pdf`,
    },
    'alerts-csv': {
      url: '/exports/security-alerts/csv',
      filename: `security-alerts-${Date.now()}.csv`,
    },
  }[kind];

  const response = await apiClient.get<Blob>(endpointMap.url, { responseType: 'blob' });
  triggerBlobDownload(response.data, endpointMap.filename);
}
