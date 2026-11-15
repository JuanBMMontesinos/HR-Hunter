import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'solid' | 'ghost' | 'neutral';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'solid',
  icon,
  children,
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  const classes = ['hr-btn', `hr-btn--${variant}`, className].filter(Boolean).join(' ');

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
