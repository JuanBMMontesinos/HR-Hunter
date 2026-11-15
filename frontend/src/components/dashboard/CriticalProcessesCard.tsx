import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import type { CriticalProcessesData } from '../../types/domain';

export function CriticalProcessesCard({ data }: { data: CriticalProcessesData | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const items = data?.items || [];

  return (
    <section className="hr-card hr-section-card" data-testid="critical-processes-card">
      <header className="hr-chart-card__head">
        <div>
          <h2 className="hr-chart-card__title">
            <AlertTriangle size={18} className="hr-inline-icon" aria-hidden="true" />
            {t('dashboard.criticalTitle')}
          </h2>
          {data ? (
            <p className="hr-text-muted">
              {t('dashboard.criticalSubtitle', {
                jobs: data.longOpenJobsCount,
                stalled: data.stalledProcessesCount,
              })}
            </p>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="ghost"
          icon={<ExternalLink size={14} />}
          onClick={() => navigate('/processes')}
        >
          {t('dashboard.quickViewCritical')}
        </Button>
      </header>

      {items.length === 0 ? (
        <p className="hr-text-muted">{t('table.noResults')}</p>
      ) : (
        <div className="hr-table-scroll">
          <table className="hr-mini-table">
            <thead>
              <tr>
                <th>{t('jobOpenings.jobTitle')}</th>
                <th>{t('jobOpenings.company')}</th>
                <th>Tipo</th>
                <th>{t('common.days')}</th>
                <th>{t('jobOpenings.candidates')}</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 8).map((item, idx) => (
                <tr key={`${item.jobOpeningId}-${idx}`}>
                  <td>
                    <strong>{item.title}</strong>
                  </td>
                  <td>{item.companyName}</td>
                  <td>
                    <StatusBadge
                      status={item.daysElapsed > 30 ? 'danger' : 'warning'}
                      label={item.criticalType}
                    />
                  </td>
                  <td>{item.daysElapsed}d</td>
                  <td>{item.candidateCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
