import type { ApiEnvelope } from '../types/common';
import type {
  CriticalProcessesData,
  DashboardAnalytics,
  DashboardKpis,
} from '../types/domain';
import { apiClient } from './api';

export interface DashboardFilterParams {
  startDate?: string;
  endDate?: string;
  companyId?: number;
  department?: string;
  jobOpeningId?: number;
}

export async function getDashboardKpis(
  params: Omit<DashboardFilterParams, 'jobOpeningId'> = {},
): Promise<DashboardKpis> {
  const response = await apiClient.get<ApiEnvelope<DashboardKpis>>('/dashboard/kpis', {
    params,
  });
  return response.data.data;
}

export async function getDashboardAnalytics(
  params: DashboardFilterParams = {},
): Promise<DashboardAnalytics> {
  const response = await apiClient.get<ApiEnvelope<DashboardAnalytics>>('/dashboard/analytics', {
    params,
  });
  return response.data.data;
}

export async function getCriticalProcesses(
  params: { companyId?: number } = {},
): Promise<CriticalProcessesData> {
  const response = await apiClient.get<ApiEnvelope<CriticalProcessesData>>(
    '/dashboard/critical-processes',
    { params },
  );
  return response.data.data;
}
