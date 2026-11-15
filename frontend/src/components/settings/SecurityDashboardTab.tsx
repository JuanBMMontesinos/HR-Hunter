import { CheckCircle2, Download, FileWarning, RefreshCw, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { Select } from '../common/Select';
import { StatusBadge } from '../common/StatusBadge';
import { useToast } from '../../contexts/ToastContext';
import { parseApiError } from '../../services/api';
import {
  downloadSecurityExport,
  generateSecurityReport,
  getSecurityStats,
  listSecurityAlerts,
  listSecurityReports,
  resolveSecurityAlert,
} from '../../services/securityAdminService';
import type { PaginationState } from '../../types/common';
import {
  toPaginationState,
  type SecurityAlert,
  type SecurityAlertStatus,
  type SecurityReport,
  type SecurityStats,
} from '../../types/domain';
import { formatDateTime } from '../../utils/formatters';

function severityVariant(sev: string) {
  if (sev === 'CRITICAL' || sev === 'HIGH') return 'danger' as const;
  if (sev === 'MEDIUM') return 'warning' as const;
  return 'info' as const;
}

export function SecurityDashboardTab() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [reports, setReports] = useState<SecurityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [generatingReport, setGeneratingReport] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<SecurityAlert | null>(null);
  const [resolveStatus, setResolveStatus] = useState<Exclude<SecurityAlertStatus, 'ACTIVE'>>('RESOLVED');
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [st, al, reps] = await Promise.all([
        getSecurityStats(),
        listSecurityAlerts({ page, limit: 20 }),
        listSecurityReports({ limit: 5 }),
      ]);
      setStats(st);
      setAlerts(al.items);
      setPagination(toPaginationState(al));
      setReports(reps.items);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [page, showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      void loadAll();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadAll]);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const rep = await generateSecurityReport();
      showToast({
        variant: 'info',
        message: `${t('settings.security.riskScore')}: ${rep.riskScore}/100 (${rep.riskLevel})`,
      });
      await loadAll();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleExport = async (kind: 'unauthorized-csv' | 'unauthorized-pdf' | 'alerts-csv') => {
    try {
      await downloadSecurityExport(kind);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    }
  };

  const handleResolveSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!resolveTarget) return;
    setResolving(true);
    try {
      await resolveSecurityAlert(resolveTarget.id, {
        status: resolveStatus,
        resolutionNote: resolutionNote.trim() || undefined,
      });
      showToast({ variant: 'success', message: t('settings.security.resolvedSuccess') });
      setResolveTarget(null);
      await loadAll();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setResolving(false);
    }
  };

  const latestReport = reports[0] || null;

  const columns: Array<DataTableColumn<SecurityAlert>> = [
    {
      key: 'createdAt',
      label: t('settings.audit.timestamp'),
      render: (row) => formatDateTime(row.createdAt, i18n.language),
    },
    {
      key: 'severity',
      label: 'Severidade',
      render: (row) => <StatusBadge status={severityVariant(row.severity)} label={row.severity} />,
    },
    {
      key: 'alertType',
      label: 'Tipo',
      render: (row) => (
        <div>
          <strong>{row.alertType}</strong>
          <div className="hr-text-muted">{row.message}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <StatusBadge
          status={row.status === 'ACTIVE' ? 'danger' : row.status === 'RESOLVED' ? 'success' : 'neutral'}
          label={row.status}
        />
      ),
    },
    {
      key: 'actions',
      label: t('common.actions'),
      align: 'right',
      render: (row) =>
        row.status === 'ACTIVE' ? (
          <Button
            size="sm"
            variant="neutral"
            icon={<CheckCircle2 size={14} />}
            onClick={() => {
              setResolveTarget(row);
              setResolveStatus('RESOLVED');
              setResolutionNote('');
            }}
          >
            {t('settings.security.resolve')}
          </Button>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className="hr-detail-stack" data-testid="security-dashboard-tab">
      <div className="hr-mini-stats">
        <div className="hr-mini-stat">
          <span>{t('settings.security.activeAlerts')}</span>
          <strong>{stats?.totalActive ?? 0}</strong>
        </div>
        <div className="hr-mini-stat">
          <span>{t('settings.security.unauth24h')}</span>
          <strong>{stats?.unauthorizedAttempts.last24h ?? 0}</strong>
        </div>
        <div className="hr-mini-stat">
          <span>{t('settings.security.unauth7d')}</span>
          <strong>{stats?.unauthorizedAttempts.last7d ?? 0}</strong>
        </div>
        <div className="hr-mini-stat">
          <span>{t('settings.security.riskScore')}</span>
          <strong>{latestReport ? `${latestReport.riskScore}/100` : '—'}</strong>
          {latestReport ? (
            <progress
              className="hr-risk-progress"
              max={100}
              value={latestReport.riskScore}
              aria-label={t('settings.security.riskScore')}
            />
          ) : null}
        </div>
      </div>

      <section className="hr-card hr-section-card hr-detail-stack">
        <header className="hr-chart-card__head">
          <div className="hr-row-actions">
            <Button
              size="sm"
              icon={<ShieldAlert size={14} />}
              disabled={generatingReport}
              onClick={() => void handleGenerateReport()}
              data-testid="generate-risk-report-btn"
            >
              {t('settings.security.generateReport')}
            </Button>
            <Button
              size="sm"
              variant="neutral"
              icon={<Download size={14} />}
              onClick={() => void handleExport('unauthorized-csv')}
            >
              {t('settings.security.exportUnauthCsv')}
            </Button>
            <Button
              size="sm"
              variant="neutral"
              icon={<Download size={14} />}
              onClick={() => void handleExport('unauthorized-pdf')}
            >
              {t('settings.security.exportUnauthPdf')}
            </Button>
            <Button
              size="sm"
              variant="neutral"
              icon={<Download size={14} />}
              onClick={() => void handleExport('alerts-csv')}
            >
              {t('settings.security.exportAlertsCsv')}
            </Button>
          </div>
          <div className="hr-row-actions">
            <label className="hr-checkbox-row">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>{t('settings.security.autoRefresh30s')}</span>
            </label>
            <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} onClick={() => void loadAll()}>
              {t('common.refresh')}
            </Button>
          </div>
        </header>

        <DataTable
          caption={t('settings.security.alertsTableTitle')}
          columns={columns}
          data={alerts}
          rowKey={(row) => row.id}
          loading={loading}
          pagination={pagination}
          onPageChange={setPage}
        />
      </section>

      {latestReport ? (
        <section className="hr-card hr-section-card hr-detail-stack">
          <h3 className="hr-chart-card__title">
            <FileWarning size={17} className="hr-inline-icon" aria-hidden="true" />
            {t('settings.security.reportsHistory')}
          </h3>
          <ul className="hr-simple-list">
            {reports.map((rep) => {
              const recs = rep.reportData?.recommendations || rep.recommendations || [];
              return (
                <li key={rep.id}>
                  <strong>
                    {formatDateTime(rep.generatedAt, i18n.language)} — Score {rep.riskScore}/100 ({rep.riskLevel})
                  </strong>
                  {recs.length > 0 ? (
                    <div className="hr-text-muted">{recs.join(' • ')}</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <Modal
        open={Boolean(resolveTarget)}
        onClose={() => setResolveTarget(null)}
        title={t('settings.security.resolveModalTitle')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResolveTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="resolve-alert-form" disabled={resolving}>
              {t('common.confirm')}
            </Button>
          </>
        }
      >
        <form id="resolve-alert-form" className="hr-detail-stack" onSubmit={(e) => void handleResolveSubmit(e)}>
          <p>{resolveTarget?.message}</p>
          <Select
            label="Status"
            value={resolveStatus}
            onChange={(e) => setResolveStatus(e.target.value as Exclude<SecurityAlertStatus, 'ACTIVE'>)}
            options={[
              { value: 'RESOLVED', label: t('settings.security.resolve') },
              { value: 'DISMISSED', label: t('settings.security.dismiss') },
            ]}
          />
          <Input
            label={t('settings.security.resolutionNote')}
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
}
