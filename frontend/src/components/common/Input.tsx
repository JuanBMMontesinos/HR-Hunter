import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
  leadingIcon?: ReactNode;
  allowPasswordToggle?: boolean;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    error,
    leadingIcon,
    allowPasswordToggle = false,
    type = 'text',
    id,
    required,
    className = '',
    containerClassName = '',
    ...props
  },
  ref,
) {
  const { t } = useTranslation();
  const generatedId = useId();
  const inputId = id ?? `hr-input-${generatedId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  const [revealed, setRevealed] = useState(false);

  const isPasswordField = type === 'password' && allowPasswordToggle;
  const effectiveType = isPasswordField && revealed ? 'text' : type;

  // Dynamic aria-describedby: include hint always when present, include error ONLY when displayed
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={['hr-field', error ? 'hr-field--error' : '', containerClassName].filter(Boolean).join(' ')}>
      <div className="hr-field__header">
        <label className="hr-field__label" htmlFor={inputId}>
          <span>{label}</span>
          {required ? (
            <span className="hr-field__required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {/* Place persistent format rules/hints ABOVE the input so mobile keyboards do not cover them */}
        {hint ? (
          <p id={hintId} className="hr-field__hint">
            {hint}
          </p>
        ) : null}
      </div>

      <div className="hr-input-control">
        {leadingIcon ? (
          <span className="hr-input-control__icon" aria-hidden="true">
            {leadingIcon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          type={effectiveType}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={[
            'hr-input',
            leadingIcon ? 'hr-input--with-leading-icon' : '',
            isPasswordField ? 'hr-input--with-trailing-action' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />

        {isPasswordField ? (
          <button
            type="button"
            className="hr-input-control__toggle"
            aria-label={revealed ? t('auth.hidePassword') : t('auth.showPassword')}
            aria-pressed={revealed}
            onClick={() => setRevealed((prev) => !prev)}
          >
            {revealed ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        ) : null}
      </div>

      {isPasswordField && revealed ? (
        <p className="hr-field__warning" role="status">
          {t('auth.passwordRevealWarning')}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="hr-field__error" role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
});
