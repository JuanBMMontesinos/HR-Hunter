export type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral';

export interface StatusBadgeProps {
  status: StatusVariant;
  label: string;
  testId?: string;
}

export function StatusBadge({ status, label, testId }: StatusBadgeProps) {
  return (
    <span className={`hr-badge hr-badge--${status}`} data-testid={testId}>
      <span className="hr-badge__dot" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
