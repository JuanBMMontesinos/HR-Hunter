import type { ReactNode } from 'react';

export interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  tone?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  testId?: string;
}

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'primary',
  testId,
}: KpiCardProps) {
  return (
    <article className={`hr-card hr-kpi-card hr-kpi-card--${tone}`} data-testid={testId}>
      <div className="hr-kpi-card__head">
        <span className="hr-kpi-card__label">{label}</span>
        <span className="hr-kpi-card__icon" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="hr-kpi-card__value">{value}</div>
      {hint ? <div className="hr-kpi-card__hint">{hint}</div> : null}
    </article>
  );
}
