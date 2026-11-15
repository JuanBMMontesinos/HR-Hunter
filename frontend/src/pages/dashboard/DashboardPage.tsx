import {
  Briefcase,
  Building2,
  Clock,
  FileCheck2,
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Workflow,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { DashboardChartsGrid } from '../../components/dashboard/AccessibleCharts';
import { CriticalProcessesCard } from '../../components/dashboard/CriticalProcessesCard';
import { KpiCard } from '../../components/dashboard/KpiCard';
import { useToast } from '../../contexts/ToastContext';
import { parseApiError } from '../../services/api';
import { listCompanies } from '../../services/companyService';
import {
  getCriticalProcesses,
  getDashboardAnalytics,
  getDashboardKpis,
} from '../../services/dashboardService';
import type { SelectOption } from '../../types/common';
import type {
  CriticalProcessesData,
  DashboardAnalytics,
  DashboardKpis,
} from '../../types/domain';

type PeriodPreset = '7d' | '30d' | '90d' | 'custom';

function computePresetDates(preset: PeriodPreset): { startDate?: string; endDate?: string } {
  if (preset === 'custom') return {};
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [period, setPeriod] = useState<PeriodPreset>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [department, setDepartment] = useState('');

  const [companyOptions, setCompanyOptions] = useState<SelectOption[]>([]);
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [critical, setCritical] = useState<CriticalProcessesData | null>(null);

  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    listCompanies({ limit: 20 })
      .then((res) => {
        setCompanyOptions(
          res.items.map((c) => ({ value: String(c.id), label: c.legalName })),
        );
      })
      .catch(() => null);
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const presetDates = computePresetDates(period);
      const startDate = period === 'custom' ? customStart || undefined : presetDates.startDate;
      const endDate = period === 'custom' ? customEnd || undefined : presetDates.endDate;
      const compNum = companyId ? Number(companyId) : undefined;
      const dept = department.trim() || undefined;

      const [kpisData, analyticsData, criticalData] = await Promise.all([
        getDashboardKpis({ startDate, endDate, companyId: compNum, department: dept }),
        getDashboardAnalytics({ startDate, endDate, companyId: compNum, department: dept }),
        getCriticalProcesses({ companyId: compNum }),
      ]);

      setKpis(kpisData);
      setAnalytics(analyticsData);
      setCritical(criticalData);
      setLastUpdated(new Date());
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd, companyId, department, showToast]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = window.setInterval(() => {
      void loadDashboard();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadDashboard]);

  const formattedTime = new Intl.DateTimeFormat(i18n.language === 'en-US' ? 'en-US' : 'pt-BR', {
    timeStyle: 'medium',
  }).format(lastUpdated);

  return (
    <div className="hr-page" data-testid="dashboard-page">
      <div className="hr-page-heading hr-page-heading--row">
        <div>
          <h1 className="hr-page-heading__title">
            <LayoutDashboard size={24} className="hr-inline-icon" aria-hidden="true" />
            {t('dashboard.title')}
          </h1>
          <p className="hr-page-heading__subtitle">
            {t('pages.dashboardSubtitle')} • {t('dashboard.lastUpdated', { time: formattedTime })}
          </p>
        </div>
        <div className="hr-row-actions">
          <label className="hr-checkbox-row">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>{t('dashboard.autoRefresh')}</span>
          </label>
          <Button
            size="sm"
            variant="neutral"
            icon={<RefreshCw size={15} />}
            onClick={() => void loadDashboard()}
            disabled={loading}
            data-testid="dashboard-refresh-btn"
          >
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      <section className="hr-card hr-dashboard-filters" aria-label={t('common.filter')}>
        <Select
          label={t('dashboard.period')}
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodPreset)}
          options={[
            { value: '7d', label: t('dashboard.period7d') },
            { value: '30d', label: t('dashboard.period30d') },
            { value: '90d', label: t('dashboard.period90d') },
            { value: 'custom', label: t('dashboard.periodCustom') },
          ]}
        />
        {period === 'custom' ? (
          <>
            <Input
              label={t('dashboard.startDate')}
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <Input
              label={t('dashboard.endDate')}
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </>
        ) : null}
        <Select
          label={t('dashboard.company')}
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          placeholder={t('common.all')}
          options={companyOptions}
        />
        <Input
          label={t('dashboard.department')}
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder={t('common.all')}
        />
      </section>

      <section className="hr-kpi-grid" aria-label="KPIs" data-testid="dashboard-kpis">
        <KpiCard
          label={t('dashboard.kpiCompanies')}
          value={kpis?.totalCompanies ?? '—'}
          icon={<Building2 size={20} />}
          tone="secondary"
          testId="kpi-companies"
        />
        <KpiCard
          label={t('dashboard.kpiActiveJobs')}
          value={kpis?.activeJobOpenings ?? '—'}
          icon={<Briefcase size={20} />}
          tone="primary"
          testId="kpi-active-jobs"
        />
        <KpiCard
          label={t('dashboard.kpiCandidates')}
          value={kpis?.totalCandidates ?? '—'}
          icon={<UserCheck size={20} />}
          tone="success"
          testId="kpi-candidates"
        />
        <KpiCard
          label={t('dashboard.kpiOngoingProcesses')}
          value={kpis?.ongoingProcesses ?? '—'}
          icon={<Workflow size={20} />}
          tone="primary"
          testId="kpi-processes"
        />
        <KpiCard
          label={t('dashboard.kpiPendingOffers')}
          value={kpis?.pendingOffers ?? '—'}
          icon={<FileCheck2 size={20} />}
          tone="warning"
          testId="kpi-offers"
        />
        <KpiCard
          label={t('dashboard.kpiConversion')}
          value={kpis ? `${kpis.conversionRate}%` : '—'}
          icon={<TrendingUp size={20} />}
          tone="success"
          testId="kpi-conversion"
        />
        <KpiCard
          label={t('dashboard.kpiAvgDays')}
          value={kpis ? `${kpis.avgDaysToFill}d` : '—'}
          icon={<Clock size={20} />}
          tone="secondary"
          testId="kpi-avg-days"
        />
      </section>

      <DashboardChartsGrid analytics={analytics} />

      <div className="hr-dashboard-bottom">
        <CriticalProcessesCard data={critical} />

        <div className="hr-dashboard-side">
          <section className="hr-card hr-section-card" data-testid="top-companies-card">
            <h2 className="hr-chart-card__title">{t('dashboard.topCompaniesTitle')}</h2>
            {(analytics?.topCompanies || []).length === 0 ? (
              <p className="hr-text-muted">{t('common.noData')}</p>
            ) : (
              <div className="hr-table-scroll">
                <table className="hr-mini-table">
                  <thead>
                    <tr>
                      <th>{t('dashboard.company')}</th>
                      <th>{t('companies.activeJobs')}</th>
                      <th>{t('jobOpenings.hiredCandidates')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.topCompanies.map((c) => (
                      <tr key={c.companyId}>
                        <td>{c.companyName}</td>
                        <td>{c.activeJobOpenings}</td>
                        <td>{c.hiredCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="hr-card hr-section-card">
            <h2 className="hr-chart-card__title">{t('dashboard.quickActionsTitle')}</h2>
            <div className="hr-quick-actions">
              <Button variant="solid" size="sm" onClick={() => navigate('/job-openings')}>
                {t('dashboard.quickNewJob')}
              </Button>
              <Button variant="neutral" size="sm" onClick={() => navigate('/candidates')}>
                {t('dashboard.quickNewCandidate')}
              </Button>
              <Button variant="neutral" size="sm" onClick={() => navigate('/processes')}>
                {t('dashboard.quickNewProcess')}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
