import { Eye } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { FilterBar } from '../common/FilterBar';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { Select } from '../common/Select';
import { StatusBadge } from '../common/StatusBadge';
import { useToast } from '../../contexts/ToastContext';
import { parseApiError } from '../../services/api';
import { listAuditLog } from '../../services/settingsService';
import type { PaginationState } from '../../types/common';
import { toPaginationState, type AuditLogEntry } from '../../types/domain';
import { formatDateTime } from '../../utils/formatters';

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'RETENTION', 'PERMISSION_CHANGE', 'EXPORT'];

export function AuditLogTab() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);

  const [tableFilter, setTableFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [page, setPage] = useState(1);

  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAuditLog({
        page,
        limit: 20,
        tableName: tableFilter.trim() || undefined,
        action: actionFilter || undefined,
        startDate: startDate || undefined,
      });
      setRows(res.items);
      setPagination(toPaginationState(res));
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [page, tableFilter, actionFilter, startDate, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: Array<DataTableColumn<AuditLogEntry>> = [
    {
      key: 'createdAt',
      label: t('settings.audit.timestamp'),
      render: (row) => formatDateTime(row.createdAt, i18n.language),
    },
    {
      key: 'userName',
      label: t('settings.audit.user'),
      render: (row) => row.userName || row.userEmail || `#${row.userId ?? 'system'}`,
    },
    {
      key: 'action',
      label: t('settings.audit.action'),
      render: (row) => <StatusBadge status="info" label={row.action} />,
    },
    {
      key: 'tableName',
      label: t('settings.audit.tableName'),
      render: (row) => (
        <code>
          {row.tableName}
          {row.recordId ? `#${row.recordId}` : ''}
        </code>
      ),
    },
    {
      key: 'ipAddress',
      label: t('settings.audit.ipAddress'),
      render: (row) => row.ipAddress || '—',
    },
    {
      key: 'actions',
      label: t('common.actions'),
      align: 'right',
      render: (row) => (
        <Button size="sm" variant="ghost" icon={<Eye size={14} />} onClick={() => setSelectedEntry(row)}>
          {t('settings.audit.viewDiff')}
        </Button>
      ),
    },
  ];

  return (
    <div className="hr-detail-stack">
      <FilterBar
        searchValue={tableFilter}
        onSearchChange={(val) => {
          setTableFilter(val);
          setPage(1);
        }}
        searchPlaceholder={t('settings.audit.tableName')}
        hasActiveFilters={Boolean(actionFilter || startDate)}
        onClearFilters={() => {
          setTableFilter('');
          setActionFilter('');
          setStartDate('');
          setPage(1);
        }}
      >
        <Select
          label={t('settings.audit.action')}
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          placeholder={t('common.all')}
          options={ACTIONS.map((a) => ({ value: a, label: a }))}
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
        caption={t('settings.tabs.auditLog')}
        columns={columns}
        data={rows}
        rowKey={(row) => row.id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
      />

      <Modal
        open={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        title={t('settings.audit.diffTitle', { id: selectedEntry?.id ?? '' })}
        size="lg"
        footer={
          <Button variant="ghost" onClick={() => setSelectedEntry(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {selectedEntry ? (
          <div className="hr-form-grid">
            <div>
              <strong>{t('settings.audit.oldValue')}</strong>
              <pre className="hr-json-box">
                {JSON.stringify(selectedEntry.oldValue ?? null, null, 2)}
              </pre>
            </div>
            <div>
              <strong>{t('settings.audit.newValue')}</strong>
              <pre className="hr-json-box">
                {JSON.stringify(selectedEntry.newValue ?? null, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
