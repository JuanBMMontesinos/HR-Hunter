import { Search, X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

export interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  children?: ReactNode;
  actions?: ReactNode;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchLabel,
  onClearFilters,
  hasActiveFilters = false,
  children,
  actions,
}: FilterBarProps) {
  const { t } = useTranslation();
  const searchId = useId();
  const labelText = searchLabel ?? t('common.search');
  const showClear = Boolean(onClearFilters && (searchValue.trim().length > 0 || hasActiveFilters));

  return (
    <search className="hr-filter-bar" aria-label={labelText}>
      <div className="hr-filter-bar__search">
        <label htmlFor={searchId} className="visually-hidden">
          {labelText}
        </label>
        <div className="hr-input-control">
          <span className="hr-input-control__icon" aria-hidden="true">
            <Search size={18} />
          </span>
          <input
            id={searchId}
            type="search"
            className="hr-input hr-input--with-leading-icon"
            placeholder={searchPlaceholder ?? t('table.searchPlaceholder')}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </div>

      {children ? <div className="hr-filter-bar__filters">{children}</div> : null}

      <div className="hr-filter-bar__actions">
        {showClear && onClearFilters ? (
          <Button variant="ghost" size="sm" icon={<X size={16} />} onClick={onClearFilters}>
            {t('table.clearFilters')}
          </Button>
        ) : null}
        {actions}
      </div>
    </search>
  );
}
