import axios from 'axios';

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

export const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function fetchHealthStatus(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health');
  return response.data;
}
