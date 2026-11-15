import { Bold, Italic, List, Underline } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { safeSetElementHtml } from '../../utils/sanitizer';

export interface RichTextEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  variables?: string[];
  placeholder?: string;
  disabled?: boolean;
  showPreview?: boolean;
}

const DEFAULT_VARIABLES = ['candidate_name', 'job_title', 'company_name', 'stage_name'];

export function RichTextEditor({
  label,
  value,
  onChange,
  variables = DEFAULT_VARIABLES,
  placeholder,
  disabled = false,
  showPreview = true,
}: RichTextEditorProps) {
  const { t } = useTranslation();
  const textareaId = useId();
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = previewRef.current;
    if (!el || !showPreview) return;
    let cancelled = false;

    void safeSetElementHtml(el, value).catch(() => {
      if (!cancelled && el) {
        el.textContent = value;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [value, showPreview]);

  const wrapSelection = (before: string, after: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || 'texto';
    const nextValue = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(nextValue);

    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  const insertToken = (token: string) => {
    const textarea = textareaRef.current;
    const snippet = `{{${token}}}`;
    if (!textarea) {
      onChange(`${value}${snippet}`);
      return;
    }

    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
    onChange(nextValue);

    window.requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + snippet.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className="hr-editor">
      <div className="hr-editor__header">
        <label htmlFor={textareaId} className="hr-field__label">
          {label}
        </label>
        <span className="hr-field__hint">{t('editor.sanitizedNotice')}</span>
      </div>

      <div className="hr-editor__toolbar" role="toolbar" aria-label={label}>
        <button
          type="button"
          className="hr-editor__tool-btn"
          disabled={disabled}
          aria-label={t('editor.bold')}
          title={t('editor.bold')}
          onClick={() => wrapSelection('<strong>', '</strong>')}
        >
          <Bold size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="hr-editor__tool-btn"
          disabled={disabled}
          aria-label={t('editor.italic')}
          title={t('editor.italic')}
          onClick={() => wrapSelection('<em>', '</em>')}
        >
          <Italic size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="hr-editor__tool-btn"
          disabled={disabled}
          aria-label={t('editor.underline')}
          title={t('editor.underline')}
          onClick={() => wrapSelection('<u>', '</u>')}
        >
          <Underline size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="hr-editor__tool-btn"
          disabled={disabled}
          aria-label={t('editor.list')}
          title={t('editor.list')}
          onClick={() => wrapSelection('<ul>\n  <li>', '</li>\n</ul>')}
        >
          <List size={16} aria-hidden="true" />
        </button>

        {variables.length > 0 ? (
          <div className="hr-editor__variables">
            <span className="hr-editor__variables-label">{t('editor.insertVariable')}</span>
            {variables.map((variable) => (
              <button
                key={variable}
                type="button"
                className="hr-editor__var-chip"
                disabled={disabled}
                onClick={() => insertToken(variable)}
              >
                {`{{${variable}}}`}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <textarea
        ref={textareaRef}
        id={textareaId}
        className="hr-editor__textarea"
        rows={6}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={t('editor.sourceLabel')}
        onChange={(event) => onChange(event.target.value)}
      />

      {showPreview ? (
        <div className="hr-editor__preview-box">
          <p className="hr-editor__preview-title">{t('editor.previewLabel')}</p>
          <div
            ref={previewRef}
            className="hr-editor__preview-content"
            data-testid="rich-text-sanitized-preview"
          />
        </div>
      ) : null}
    </div>
  );
}
