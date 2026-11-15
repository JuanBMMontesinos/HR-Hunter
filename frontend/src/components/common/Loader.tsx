import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface LoaderProps {
  label?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Loader({ label, fullScreen = false, size = 'md' }: LoaderProps) {
  const { t } = useTranslation();
  const displayLabel = label ?? t('common.loading');
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 32 : 24;

  return (
    <div
      className={fullScreen ? 'hr-loader hr-loader--fullscreen' : 'hr-loader'}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 size={iconSize} className="hr-loader__spinner" aria-hidden="true" />
      <span className="hr-loader__text">{displayLabel}</span>
    </div>
  );
}

export interface SkeletonProps {
  width?: string;
  height?: string;
  variant?: 'text' | 'rect' | 'circle';
  className?: string;
}

export function Skeleton({
  width = '100%',
  height = '1rem',
  variant = 'rect',
  className = '',
}: SkeletonProps) {
  return (
    <span
      className={['hr-skeleton', `hr-skeleton--${variant}`, className].filter(Boolean).join(' ')}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
