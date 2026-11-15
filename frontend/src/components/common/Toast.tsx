import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import type { ToastVariant } from '../../types/common';

const VARIANT_ICON: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
};

export function ToastViewport() {
  const { t } = useTranslation();
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="hr-toast-viewport" aria-live="polite" aria-relevant="additions text">
      {toasts.map((toast) => {
        const Icon = VARIANT_ICON[toast.variant];
        return (
          <div
            key={toast.id}
            role={toast.variant === 'danger' ? 'alert' : 'status'}
            className={`hr-toast hr-toast--${toast.variant}`}
          >
            <span className="hr-toast__icon" aria-hidden="true">
              <Icon size={20} />
            </span>
            <div className="hr-toast__content">
              {toast.title ? <p className="hr-toast__title">{toast.title}</p> : null}
              <p className="hr-toast__message">{toast.message}</p>
            </div>
            <button
              type="button"
              className="hr-toast__close"
              aria-label={t('common.close')}
              onClick={() => dismissToast(toast.id)}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
