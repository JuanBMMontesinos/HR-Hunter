import { AlertCircle, ChevronDown, X } from 'lucide-react';
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { SelectOption } from '../../types/common';

export interface AutocompleteProps {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export function Autocomplete({
  label,
  options,
  value,
  onChange,
  placeholder,
  hint,
  error,
  disabled = false,
  required = false,
  id,
}: AutocompleteProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const inputId = id ?? `hr-autocomplete-${generatedId}`;
  const listboxId = `${inputId}-listbox`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value],
  );

  const [query, setQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const displayText = isOpen ? query : (selectedOption?.label ?? query);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(normalized) ||
        opt.value.toLowerCase().includes(normalized) ||
        (opt.hint && opt.hint.toLowerCase().includes(normalized)),
    );
  }, [options, query]);

  const selectOption = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setQuery(option.label);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setIsOpen(true);
      setActiveIndex(0);
      event.preventDefault();
      return;
    }

    if (!isOpen) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1 < filteredOptions.length ? prev + 1 : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 >= 0 ? prev - 1 : Math.max(0, filteredOptions.length - 1)));
    } else if (event.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
        event.preventDefault();
        selectOption(filteredOptions[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      setActiveIndex(-1);
      setQuery(selectedOption?.label ?? '');
    }
  };

  const activeDescendantId =
    isOpen && activeIndex >= 0 && filteredOptions[activeIndex]
      ? `${listboxId}-opt-${activeIndex}`
      : undefined;

  return (
    <div
      ref={wrapperRef}
      className={['hr-field hr-autocomplete', error ? 'hr-field--error' : '']
        .filter(Boolean)
        .join(' ')}
      onBlur={(event) => {
        if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
          setActiveIndex(-1);
          setQuery(selectedOption?.label ?? '');
        }
      }}
    >
      <div className="hr-field__header">
        <label className="hr-field__label" htmlFor={inputId}>
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

      <div className="hr-autocomplete__control">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeDescendantId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          className="hr-input hr-input--with-trailing-action"
          disabled={disabled}
          required={required}
          placeholder={placeholder ?? t('common.selectPlaceholder')}
          value={displayText}
          onFocus={() => {
            setQuery(selectedOption?.label ?? '');
            setIsOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!event.target.value) {
              onChange('');
            }
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
        />

        <div className="hr-autocomplete__buttons">
          {value && !disabled ? (
            <button
              type="button"
              className="hr-input-control__toggle"
              aria-label={t('common.clear')}
              onClick={() => {
                onChange('');
                setQuery('');
                setActiveIndex(-1);
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="hr-input-control__toggle"
            aria-label={label}
            aria-expanded={isOpen}
            disabled={disabled}
            onClick={() => {
              setIsOpen((prev) => !prev);
              setQuery(selectedOption?.label ?? '');
            }}
          >
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </div>

        {isOpen ? (
          <ul id={listboxId} role="listbox" className="hr-autocomplete__listbox">
            {filteredOptions.length === 0 ? (
              <li className="hr-autocomplete__empty" aria-disabled="true">
                {t('table.noResults')}
              </li>
            ) : (
              filteredOptions.map((option, idx) => (
                <li
                  key={option.value}
                  id={`${listboxId}-opt-${idx}`}
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled || undefined}
                  className={[
                    'hr-autocomplete__option',
                    idx === activeIndex ? 'is-active' : '',
                    option.value === value ? 'is-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectOption(option);
                  }}
                >
                  <span>{option.label}</span>
                  {option.hint ? <span className="hr-autocomplete__option-hint">{option.hint}</span> : null}
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} className="hr-field__error" role="alert">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
