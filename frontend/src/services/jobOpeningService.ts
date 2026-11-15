import type { ApiEnvelope } from '../types/common';
import type {
  JobOpening,
  JobOpeningAnalytics,
  JobOpeningPayload,
  PaginatedResult,
  ProcessItem,
} from '../types/domain';
import { apiClient } from './api';

export interface JobOpeningFilters {
  page?: number;
  limit?: number;
  companyId?: number;
  status?: string;
  level?: string;
  department?: string;
  contractType?: string;
  regime?: string;
  priority?: string;
  responsibleUserId?: number;
  search?: string;
}

export async function listJobOpenings(
  filters: JobOpeningFilters = {},
): Promise<PaginatedResult<JobOpening>> {
  const response = await apiClient.get<ApiEnvelope<PaginatedResult<JobOpening>>>('/job-openings', {
    params: filters,
  });
  return response.data.data;
}

export async function getJobOpeningById(id: number): Promise<JobOpening> {
  const response = await apiClient.get<ApiEnvelope<JobOpening>>(`/job-openings/${id}`);
  return response.data.data;
}

export async function getJobOpeningCandidates(id: number): Promise<ProcessItem[]> {
  const response = await apiClient.get<ApiEnvelope<ProcessItem[]>>(`/job-openings/${id}/candidates`);
  return response.data.data;
}

export async function getJobOpeningAnalytics(id: number): Promise<JobOpeningAnalytics> {
  const response = await apiClient.get<ApiEnvelope<JobOpeningAnalytics>>(`/job-openings/${id}/analytics`);
  return response.data.data;
}

export async function createJobOpening(payload: JobOpeningPayload): Promise<JobOpening> {
  const response = await apiClient.post<ApiEnvelope<JobOpening>>('/job-openings', payload);
  return response.data.data;
}

export async function updateJobOpening(
  id: number,
  payload: Partial<JobOpeningPayload>,
): Promise<JobOpening> {
  const response = await apiClient.put<ApiEnvelope<JobOpening>>(`/job-openings/${id}`, payload);
  return response.data.data;
}

export async function deleteJobOpening(id: number): Promise<void> {
  await apiClient.delete(`/job-openings/${id}`);
}
