import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { FilterBar } from '../common/FilterBar';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { StatusBadge } from '../common/StatusBadge';
import { useToast } from '../../contexts/ToastContext';
import { parseApiError } from '../../services/api';
import { listLoginHistory } from '../../services/settingsService';
import type { PaginationState } from '../../types/common';
import { toPaginationState, type LoginHistoryEntry } from '../../types/domain';
import { formatDateTime } from '../../utils/formatters';

export function LoginHistoryTab() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [rows, setRows] = useState<LoginHistoryEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  const [emailFilter, setEmailFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const isSuccessful =
        statusFilter === 'true' ? true : statusFilter === 'false' ? false : undefined;
      const res = await listLoginHistory({
        page,
        limit: 20,
        email: emailFilter.trim() || undefined,
        isSuccessful,
        startDate: startDate || undefined,
      });
      setRows(res.items);
      setPagination(toPaginationState(res));
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [page, emailFilter, statusFilter, startDate, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Array<DataTableColumn<LoginHistoryEntry>> = [
    {
      key: 'loginTime',
      label: t('settings.loginHistory.loginTime'),
      render: (row) => formatDateTime(row.loginTime, i18n.language),
    },
    {
      key: 'emailAttempted',
      label: t('settings.loginHistory.emailAttempted'),
      render: (row) => (
        <div>
          <strong>{row.emailAttempted}</strong>
          {row.userName ? <div className="hr-text-muted">{row.userName}</div> : null}
        </div>
      ),
    },
    {
      key: 'isSuccessful',
      label: t('settings.loginHistory.status'),
      render: (row) => (
        <StatusBadge
          status={row.isSuccessful ? 'success' : 'danger'}
          label={
            row.isSuccessful
              ? t('settings.loginHistory.successLabel')
              : t('settings.loginHistory.failureLabel')
          }
        />
      ),
    },
    {
      key: 'failureReason',
      label: t('settings.loginHistory.reason'),
      render: (row) => row.failureReason || '—',
    },
    {
      key: 'ipAddress',
      label: t('settings.audit.ipAddress'),
      render: (row) => row.ipAddress || '—',
    },
  ];

  return (
    <div className="hr-detail-stack">
      <FilterBar
        searchValue={emailFilter}
        onSearchChange={(val) => {
          setEmailFilter(val);
          setPage(1);
        }}
        searchPlaceholder={t('settings.loginHistory.emailAttempted')}
        hasActiveFilters={Boolean(statusFilter || startDate)}
        onClearFilters={() => {
          setEmailFilter('');
          setStatusFilter('');
          setStartDate('');
          setPage(1);
        }}
      >
        <Select
          label={t('settings.loginHistory.status')}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.all')}
          options={[
            { value: 'true', label: t('settings.loginHistory.successLabel') },
            { value: 'false', label: t('settings.loginHistory.failureLabel') },
          ]}
        />
        <Input
          label={t('dashboard.startDate')}
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
        />
      </FilterBar>

      <DataTable
        caption={t('settings.tabs.loginHistory')}
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
      />
    </div>
  );
}
