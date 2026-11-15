import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { PaginationState, SortState } from '../../types/common';
import { Button } from './Button';
import { Skeleton } from './Loader';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  caption: string;
  columns: Array<DataTableColumn<T>>;
  data: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyMessage?: string;
  sortState?: SortState | null;
  onSortChange?: (next: SortState) => void;
  pagination?: PaginationState;
  onPageChange?: (nextPage: number) => void;
}

export function DataTable<T>({
  caption,
  columns,
  data,
  rowKey,
  loading = false,
  emptyMessage,
  sortState,
  onSortChange,
  pagination,
  onPageChange,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const captionId = useId();
  const [internalSort, setInternalSort] = useState<SortState | null>(null);
  const [announcement, setAnnouncement] = useState<string>('');

  const activeSort = sortState !== undefined ? sortState : internalSort;

  const handleSortClick = (column: DataTableColumn<T>) => {
    if (!column.sortable) return;

    const nextDirection =
      activeSort && activeSort.key === column.key && activeSort.direction === 'asc' ? 'desc' : 'asc';
    const nextState: SortState = { key: column.key, direction: nextDirection };

    if (onSortChange) {
      onSortChange(nextState);
    } else {
      setInternalSort(nextState);
    }

    setAnnouncement(
      t('table.sortedStatus', {
        column: column.label,
        direction: nextDirection === 'asc' ? t('table.ascending') : t('table.descending'),
        count: data.length,
      }),
    );
  };

  // Client-side sort only when consumer does not control sort via onSortChange
  const displayRows = (() => {
    if (onSortChange || !activeSort) return data;
    const col = columns.find((c) => c.key === activeSort.key);
    if (!col) return data;

    const sorted = [...data].sort((a, b) => {
      const valA = col.sortValue
        ? col.sortValue(a)
        : String((a as Record<string, unknown>)[col.key] ?? '');
      const valB = col.sortValue
        ? col.sortValue(b)
        : String((b as Record<string, unknown>)[col.key] ?? '');

      if (typeof valA === 'number' && typeof valB === 'number') {
        return activeSort.direction === 'asc' ? valA - valB : valB - valA;
      }

      const cmp = String(valA).localeCompare(String(valB), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return activeSort.direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  })();

  const renderSortIcon = (columnKey: string) => {
    if (!activeSort || activeSort.key !== columnKey) {
      return <ArrowUpDown size={14} aria-hidden="true" />;
    }
    return activeSort.direction === 'asc' ? (
      <ArrowUp size={14} aria-hidden="true" />
    ) : (
      <ArrowDown size={14} aria-hidden="true" />
    );
  };

  return (
    <div className="hr-table-card">
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div className="hr-table-wrapper" tabIndex={0} role="region" aria-labelledby={captionId}>
        <table className="hr-table">
          <caption id={captionId} className="hr-table__caption">
            {caption}
          </caption>
          <thead>
            <tr>
              {columns.map((column) => {
                const isSortedColumn = activeSort?.key === column.key;
                const ariaSort = isSortedColumn
                  ? activeSort.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : undefined;

                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={column.align ? `hr-table__align-${column.align}` : undefined}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        className={['hr-table__sort-btn', isSortedColumn ? 'is-sorted' : '']
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => handleSortClick(column)}
                      >
                        <span>{column.label}</span>
                        {renderSortIcon(column.key)}
                      </button>
                    ) : (
                      <span>{column.label}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, rowIdx) => (
                <tr key={`skeleton-${rowIdx}`} className="hr-table__skeleton-row">
                  {columns.map((column) => (
                    <td key={column.key} data-label={column.label}>
                      <Skeleton height="1.125rem" />
                    </td>
                  ))}
                </tr>
              ))
            ) : displayRows.length === 0 ? (
              <tr className="hr-table__empty-row">
                <td colSpan={columns.length}>{emptyMessage ?? t('table.noResults')}</td>
              </tr>
            ) : (
              displayRows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      data-label={column.label}
                      className={column.align ? `hr-table__align-${column.align}` : undefined}
                    >
                      {column.render
                        ? column.render(row)
                        : String((row as Record<string, unknown>)[column.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination ? (
        <div className="hr-table-pagination">
          <span className="hr-table-pagination__summary">
            {t('table.totalItems', { total: pagination.total })}
          </span>
          <div className="hr-table-pagination__controls">
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page <= 1 || !onPageChange}
              icon={<ChevronLeft size={16} />}
              onClick={() => onPageChange?.(pagination.page - 1)}
            >
              {t('table.previousPage')}
            </Button>
            <span className="hr-table-pagination__page">
              {t('table.pageInfo', {
                page: pagination.page,
                totalPages: Math.max(1, pagination.totalPages),
              })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || !onPageChange}
              onClick={() => onPageChange?.(pagination.page + 1)}
            >
              {t('table.nextPage')}
              <ChevronRight size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
