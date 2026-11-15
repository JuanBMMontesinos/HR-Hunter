import { AlertCircle } from 'lucide-react';
import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import type { SelectOption } from '../../types/common';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  placeholder?: string;
  hint?: string;
  error?: string | null;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    options,
    placeholder,
    hint,
    error,
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
  const selectId = id ?? `hr-select-${generatedId}`;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={['hr-field', error ? 'hr-field--error' : '', containerClassName].filter(Boolean).join(' ')}>
      <div className="hr-field__header">
        <label className="hr-field__label" htmlFor={selectId}>
          <span>{label}</span>
          {required ? (
            <span className="hr-field__required" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {hint ? (
          <p id={hintId} className="hr-field__hint">
            {hint}
          </p>
        ) : null}
      </div>

      <select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={['hr-select', className].filter(Boolean).join(' ')}
        {...props}
      >
        {placeholder !== '' ? (
          <option value="">{placeholder ?? t('common.selectPlaceholder')}</option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      {error ? (
        <p id={errorId} className="hr-field__error" role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
});
