import type { ApiEnvelope } from '../types/common';
import type {
  Company,
  CompanyDetail,
  CompanyPayload,
  PaginatedResult,
} from '../types/domain';
import { apiClient } from './api';

export interface CompanyFilters {
  page?: number;
  limit?: number;
  search?: string;
  name?: string;
  status?: string;
  sector?: string;
  cnpj?: string;
}

export async function listCompanies(
  filters: CompanyFilters = {},
): Promise<PaginatedResult<Company>> {
  const safeLimit = Math.min(20, Math.max(1, filters.limit ?? 20));
  const response = await apiClient.get<ApiEnvelope<PaginatedResult<Company>>>('/companies', {
    params: { ...filters, limit: safeLimit },
  });
  return response.data.data;
}

export async function getCompanyById(id: number): Promise<CompanyDetail> {
  const response = await apiClient.get<ApiEnvelope<CompanyDetail>>(`/companies/${id}`);
  return response.data.data;
}

export async function createCompany(payload: CompanyPayload): Promise<Company> {
  const response = await apiClient.post<ApiEnvelope<Company>>('/companies', payload);
  return response.data.data;
}

export async function updateCompany(
  id: number,
  payload: Partial<CompanyPayload>,
): Promise<Company> {
  const response = await apiClient.put<ApiEnvelope<Company>>(`/companies/${id}`, payload);
  return response.data.data;
}

export async function deleteCompany(id: number): Promise<void> {
  await apiClient.delete(`/companies/${id}`);
}
