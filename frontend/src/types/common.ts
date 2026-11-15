export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorEnvelope {
  success: false;
  error: ApiErrorDetail;
  timestamp: string;
}

export interface ParsedApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  key: string;
  direction: SortDirection;
}

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type ToastVariant = 'success' | 'warning' | 'danger' | 'info';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
}
