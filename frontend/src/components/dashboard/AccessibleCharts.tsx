import { BarChart3, Table2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import type { DashboardAnalytics } from '../../types/domain';
import { formatDate } from '../../utils/formatters';
import { translateStageName } from '../../utils/stageTranslation';

const CHART_COLORS = ['#F7941E', '#3C7EFF', '#3CB371', '#FFB347', '#D64545', '#8E6CFF'];

interface ChartShellProps {
  title: string;
  empty: boolean;
  chartView: ReactNode;
  tableHeaders: [string, string, string?];
  tableRows: Array<{ label: string; value: string | number; extra?: string }>;
  testId: string;
}

function ChartCardShell({
  title,
  empty,
  chartView,
  tableHeaders,
  tableRows,
  testId,
}: ChartShellProps) {
  const { t } = useTranslation();
  const [showTable, setShowTable] = useState(false);

  return (
    <section className="hr-card hr-chart-card" data-testid={testId}>
      <header className="hr-chart-card__head">
        <h2 className="hr-chart-card__title">{title}</h2>
        <Button
          size="sm"
          variant="ghost"
          icon={showTable ? <BarChart3 size={14} /> : <Table2 size={14} />}
          onClick={() => setShowTable((prev) => !prev)}
          data-testid={`${testId}-toggle`}
        >
          {showTable ? t('dashboard.toggleChartMode') : t('dashboard.toggleTableMode')}
        </Button>
      </header>

      {empty ? (
        <p className="hr-text-muted">{t('common.noData')}</p>
      ) : showTable ? (
        <div className="hr-table-scroll">
          <table className="hr-mini-table">
            <thead>
              <tr>
                <th>{tableHeaders[0]}</th>
                <th>{tableHeaders[1]}</th>
                {tableHeaders[2] ? <th>{tableHeaders[2]}</th> : null}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.label}</td>
                  <td>{row.value}</td>
                  {tableHeaders[2] ? <td>{row.extra ?? '—'}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        chartView
      )}
    </section>
  );
}

export function DashboardChartsGrid({ analytics }: { analytics: DashboardAnalytics | null }) {
  const { t, i18n } = useTranslation();

  const stages = analytics?.candidatesByStage || [];
  const maxStage = Math.max(1, ...stages.map((s) => Number(s.candidateCount || 0)));

  const statuses = analytics?.jobStatusDistribution || [];
  const totalStatuses = Math.max(
    1,
    statuses.reduce((acc, s) => acc + Number(s.total || 0), 0),
  );

  const depts = analytics?.candidatesByDepartment || [];
  const maxDept = Math.max(1, ...depts.map((d) => Number(d.total || 0)));

  const evolution = analytics?.candidateEvolution || [];
  const maxEvo = Math.max(1, ...evolution.map((e) => Number(e.total || 0)));

  const circumference = 2 * Math.PI * 52;
  let runningOffset = 0;

  return (
    <div className="hr-charts-grid">
      <ChartCardShell
        title={t('dashboard.chartByStage')}
        empty={stages.length === 0}
        testId="chart-by-stage"
        tableHeaders={[t('processes.stage'), t('jobOpenings.candidates'), t('processes.rating')]}
        tableRows={stages.map((s) => ({
          label: translateStageName(s.stageName, i18n.language),
          value: s.candidateCount,
          extra: s.averageRating !== null ? `${s.averageRating}/5` : '—',
        }))}
        chartView={
          <div className="hr-horiz-bars">
            {stages.map((s, idx) => {
              const pct = Math.round((Number(s.candidateCount || 0) / maxStage) * 100);
              const color = CHART_COLORS[idx % CHART_COLORS.length];
              return (
                <div key={s.stageId} className="hr-horiz-bars__row">
                  <span className="hr-horiz-bars__label">
                    {translateStageName(s.stageName, i18n.language)}
                  </span>
                  <div className="hr-horiz-bars__track">
                    <div
                      className="hr-horiz-bars__fill"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="hr-horiz-bars__val">{s.candidateCount}</span>
                </div>
              );
            })}
          </div>
        }
      />

      <ChartCardShell
        title={t('dashboard.chartJobsByStatus')}
        empty={statuses.length === 0}
        testId="chart-jobs-status"
        tableHeaders={[t('jobOpenings.status'), t('jobOpenings.title')]}
        tableRows={statuses.map((s) => ({
          label: s.status,
          value: s.total,
        }))}
        chartView={
          <div className="hr-donut-layout">
            <svg viewBox="0 0 140 140" className="hr-donut-svg" role="img" aria-label={t('dashboard.chartJobsByStatus')}>
              <circle cx="70" cy="70" r="52" fill="none" stroke="var(--color-surface-muted)" strokeWidth="18" />
              {statuses.map((item, idx) => {
                const count = Number(item.total || 0);
                const slice = (count / totalStatuses) * circumference;
                const dashArray = `${slice} ${circumference - slice}`;
                const dashOffset = -runningOffset;
                runningOffset += slice;
                return (
                  <circle
                    key={item.status}
                    cx="70"
                    cy="70"
                    r="52"
                    fill="none"
                    stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                    strokeWidth="18"
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 70 70)"
                  />
                );
              })}
              <text x="70" y="75" textAnchor="middle" className="hr-donut-total">
                {statuses.reduce((acc, s) => acc + Number(s.total || 0), 0)}
              </text>
            </svg>

            <ul className="hr-chart-legend">
              {statuses.map((item, idx) => (
                <li key={item.status} className="hr-chart-legend__item">
                  <span
                    className="hr-chart-legend__swatch"
                    style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                  />
                  <span>{item.status}</span>
                  <strong>{item.total}</strong>
                </li>
              ))}
            </ul>
          </div>
        }
      />

      <ChartCardShell
        title={t('dashboard.chartByDept')}
        empty={depts.length === 0}
        testId="chart-by-dept"
        tableHeaders={[t('dashboard.department'), t('jobOpenings.candidates')]}
        tableRows={depts.map((d) => ({
          label: d.department || '—',
          value: d.total,
        }))}
        chartView={
          <div className="hr-horiz-bars">
            {depts.map((d, idx) => {
              const pct = Math.round((Number(d.total || 0) / maxDept) * 100);
              return (
                <div key={d.department || idx} className="hr-horiz-bars__row">
                  <span className="hr-horiz-bars__label">{d.department || 'N/A'}</span>
                  <div className="hr-horiz-bars__track">
                    <div
                      className="hr-horiz-bars__fill"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: CHART_COLORS[(idx + 1) % CHART_COLORS.length],
                      }}
                    />
                  </div>
                  <span className="hr-horiz-bars__val">{d.total}</span>
                </div>
              );
            })}
          </div>
        }
      />

      <ChartCardShell
        title={t('dashboard.chartEvolution')}
        empty={evolution.length === 0}
        testId="chart-evolution"
        tableHeaders={['Data', t('jobOpenings.candidates')]}
        tableRows={evolution.map((e) => ({
          label: formatDate(e.date, i18n.language),
          value: e.total,
        }))}
        chartView={
          <svg
            viewBox="0 0 360 150"
            className="hr-line-svg"
            role="img"
            aria-label={t('dashboard.chartEvolution')}
          >
            {(() => {
              const points = evolution.map((pt, i) => {
                const x =
                  evolution.length === 1
                    ? 180
                    : 20 + (i / Math.max(1, evolution.length - 1)) * 320;
                const y = 130 - (Number(pt.total || 0) / maxEvo) * 100;
                return `${x},${y}`;
              });
              const poly = points.join(' ');
              const area = `20,130 ${poly} 340,130`;
              return (
                <>
                  <line x1="20" y1="130" x2="340" y2="130" stroke="var(--color-border)" strokeWidth="1" />
                  <polygon points={area} fill="rgba(247, 148, 30, 0.16)" />
                  <polyline fill="none" stroke="#F7941E" strokeWidth="3" points={poly} />
                  {evolution.map((pt, i) => {
                    const [cx, cy] = points[i].split(',');
                    return <circle key={pt.date} cx={cx} cy={cy} r="3.5" fill="#3C7EFF" />;
                  })}
                </>
              );
            })()}
          </svg>
        }
      />
    </div>
  );
}
