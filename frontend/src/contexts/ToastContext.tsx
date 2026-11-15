import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ToastItem, ToastVariant } from '../types/common';

export interface ShowToastOptions {
  variant?: ToastVariant;
  title?: string;
  message: string;
  durationMs?: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (options: ShowToastOptions) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let toastSeq = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timerId = timersRef.current.get(id);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const showToast = useCallback(
    ({ variant = 'info', title, message, durationMs }: ShowToastOptions): string => {
      toastSeq += 1;
      const id = `toast-${Date.now()}-${toastSeq}`;
      const timeout = durationMs ?? (variant === 'danger' || variant === 'warning' ? 6500 : 4500);

      setToasts((prev) => [...prev, { id, variant, title, message }]);

      if (timeout > 0) {
        const timerId = window.setTimeout(() => {
          dismissToast(id);
        }, timeout);
        timersRef.current.set(id, timerId);
      }

      return id;
    },
    [dismissToast],
  );

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, showToast, dismissToast, clearToasts }),
    [toasts, showToast, dismissToast, clearToasts],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
