import type { ApiEnvelope } from '../types/common';
import type {
  Candidate,
  CandidateDetail,
  CandidateEducation,
  CandidateExperience,
  CandidatePayload,
  CandidateSkill,
  CsvImportResult,
  PaginatedResult,
} from '../types/domain';
import { apiClient } from './api';

export interface CandidateFilters {
  page?: number;
  limit?: number;
  search?: string;
  name?: string;
  email?: string;
  cpf?: string;
  skill?: string;
  status?: string;
}

export async function listCandidates(
  filters: CandidateFilters = {},
): Promise<PaginatedResult<Candidate>> {
  const response = await apiClient.get<ApiEnvelope<PaginatedResult<Candidate>>>('/candidates', {
    params: filters,
  });
  return response.data.data;
}

export async function getCandidateById(id: number): Promise<CandidateDetail> {
  const response = await apiClient.get<ApiEnvelope<CandidateDetail>>(`/candidates/${id}`);
  return response.data.data;
}

export async function createCandidate(payload: CandidatePayload): Promise<CandidateDetail> {
  const response = await apiClient.post<ApiEnvelope<CandidateDetail>>('/candidates', payload);
  return response.data.data;
}

export async function updateCandidate(
  id: number,
  payload: Partial<CandidatePayload>,
): Promise<CandidateDetail> {
  const response = await apiClient.put<ApiEnvelope<CandidateDetail>>(`/candidates/${id}`, payload);
  return response.data.data;
}

export async function deleteCandidate(id: number): Promise<void> {
  await apiClient.delete(`/candidates/${id}`);
}

export async function importCandidatesCsv(csv: string): Promise<CsvImportResult> {
  const response = await apiClient.post<ApiEnvelope<CsvImportResult>>('/candidates/import', { csv });
  return response.data.data;
}

export async function importCandidatesFile(file: File): Promise<CsvImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post<ApiEnvelope<CsvImportResult>>('/candidates/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data;
}

export async function addCandidateExperience(
  candidateId: number,
  payload: Omit<CandidateExperience, 'id' | 'candidateId'>,
): Promise<CandidateExperience> {
  const response = await apiClient.post<ApiEnvelope<CandidateExperience>>(
    `/candidates/${candidateId}/experience`,
    payload,
  );
  return response.data.data;
}

export async function deleteCandidateExperience(candidateId: number, expId: number): Promise<void> {
  await apiClient.delete(`/candidates/${candidateId}/experience/${expId}`);
}

export async function addCandidateEducation(
  candidateId: number,
  payload: Omit<CandidateEducation, 'id' | 'candidateId'>,
): Promise<CandidateEducation> {
  const response = await apiClient.post<ApiEnvelope<CandidateEducation>>(
    `/candidates/${candidateId}/education`,
    payload,
  );
  return response.data.data;
}

export async function deleteCandidateEducation(candidateId: number, eduId: number): Promise<void> {
  await apiClient.delete(`/candidates/${candidateId}/education/${eduId}`);
}

export async function addCandidateSkill(
  candidateId: number,
  payload: Omit<CandidateSkill, 'id' | 'candidateId'>,
): Promise<CandidateSkill> {
  const response = await apiClient.post<ApiEnvelope<CandidateSkill>>(
    `/candidates/${candidateId}/skills`,
    payload,
  );
  return response.data.data;
}

export async function deleteCandidateSkill(candidateId: number, skillId: number): Promise<void> {
  await apiClient.delete(`/candidates/${candidateId}/skills/${skillId}`);
}
