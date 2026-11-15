import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'solid' | 'ghost' | 'neutral' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'solid',
  size = 'md',
  icon,
  children,
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  const classes = [
    'hr-btn',
    `hr-btn--${variant}`,
    size === 'sm' ? 'hr-btn--sm' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...props}>
      {icon ? (
        <span className="hr-btn__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
