import type { ApiEnvelope } from '../types/common';
import type {
  KanbanBoardData,
  OfferStatus,
  PaginatedResult,
  ProcessDetail,
  ProcessItem,
  ProcessOffer,
  ProcessRecommendation,
  ProcessTimelineData,
} from '../types/domain';
import { apiClient } from './api';

export interface ProcessFilters {
  page?: number;
  limit?: number;
  jobOpeningId?: number;
  companyId?: number;
  candidateId?: number;
  funnelId?: number;
  currentStageId?: number;
  status?: string;
  search?: string;
}

export async function listProcesses(
  filters: ProcessFilters = {},
): Promise<PaginatedResult<ProcessItem>> {
  const response = await apiClient.get<ApiEnvelope<PaginatedResult<ProcessItem>>>('/processes', {
    params: filters,
  });
  return response.data.data;
}

export async function getKanbanBoard(
  filters: Omit<ProcessFilters, 'page' | 'limit' | 'candidateId' | 'currentStageId'> = {},
): Promise<KanbanBoardData> {
  const response = await apiClient.get<ApiEnvelope<KanbanBoardData>>('/processes/kanban', {
    params: filters,
  });
  return response.data.data;
}

export async function getProcessById(id: number): Promise<ProcessDetail> {
  const response = await apiClient.get<ApiEnvelope<ProcessDetail>>(`/processes/${id}`);
  return response.data.data;
}

export async function getProcessTimeline(id: number): Promise<ProcessTimelineData> {
  const response = await apiClient.get<ApiEnvelope<ProcessTimelineData>>(`/processes/${id}/timeline`);
  return response.data.data;
}

export async function createProcess(payload: {
  jobOpeningId: number;
  candidateId: number;
  stageId?: number | null;
  feedback?: string | null;
  responsibleUserId?: number | null;
}): Promise<ProcessDetail> {
  const response = await apiClient.post<ApiEnvelope<ProcessDetail>>('/processes', payload);
  return response.data.data;
}

export async function moveToNextStage(
  processId: number,
  payload: {
    nextStageId?: number | null;
    feedback?: string | null;
    rating?: number | null;
    strengths?: string | null;
    weaknesses?: string | null;
    recommendation?: ProcessRecommendation | null;
    scheduledAt?: string | null;
  },
): Promise<ProcessDetail> {
  const response = await apiClient.post<ApiEnvelope<ProcessDetail>>(
    `/processes/${processId}/next-stage`,
    payload,
  );
  return response.data.data;
}

export async function rejectProcess(
  processId: number,
  payload: {
    reason: string;
    rating?: number | null;
    sendEmail?: boolean;
  },
): Promise<ProcessDetail> {
  const response = await apiClient.post<ApiEnvelope<ProcessDetail>>(
    `/processes/${processId}/reject`,
    payload,
  );
  return response.data.data;
}

export async function createProcessOffer(
  processId: number,
  payload: {
    position?: string | null;
    salary?: number | null;
    benefits?: string | null;
    startDate?: string | null;
    conditions?: string | null;
    sendEmail?: boolean;
  },
): Promise<{ process: ProcessDetail; offer: ProcessOffer }> {
  const response = await apiClient.post<ApiEnvelope<{ process: ProcessDetail; offer: ProcessOffer }>>(
    `/processes/${processId}/offer`,
    payload,
  );
  return response.data.data;
}

export async function updateProcessOffer(
  processId: number,
  offerId: number,
  payload: {
    status: OfferStatus;
    advanceToHired?: boolean;
  },
): Promise<{ process: ProcessDetail; offer: ProcessOffer }> {
  const response = await apiClient.patch<ApiEnvelope<{ process: ProcessDetail; offer: ProcessOffer }>>(
    `/processes/${processId}/offer/${offerId}`,
    payload,
  );
  return response.data.data;
}
