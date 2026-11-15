import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Database, Layers, Palette, RefreshCw } from 'lucide-react';
import { Button } from './components/common/Button';
import { PageHeader } from './components/common/PageHeader';
import { StatusBadge, type StatusVariant } from './components/common/StatusBadge';
import { fetchHealthStatus, type HealthData } from './services/api';

type ConnectionState = 'checking' | 'connected' | 'disconnected';

export function App() {
  const { t, i18n } = useTranslation();
  const [connectionState, setConnectionState] = useState<ConnectionState>('checking');
  const [healthData, setHealthData] = useState<HealthData | null>(null);

  const loadHealth = useCallback(async () => {
    setConnectionState('checking');
    try {
      const response = await fetchHealthStatus();
      if (response.success && response.data.database === 'connected') {
        setHealthData(response.data);
        setConnectionState('connected');
      } else {
        setConnectionState('disconnected');
      }
    } catch {
      setConnectionState('disconnected');
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    document.documentElement.lang = i18n.language || 'pt-BR';
  }, [i18n.language]);

  const badgeVariant: StatusVariant =
    connectionState === 'connected'
      ? 'success'
      : connectionState === 'disconnected'
        ? 'danger'
        : 'warning';

  const badgeLabel =
    connectionState === 'connected'
      ? t('status.connected')
      : connectionState === 'disconnected'
        ? t('status.disconnected')
        : t('status.checking');

  return (
    <div className="hr-app-shell">
      <a href="#main-content" className="hr-skip-link visually-hidden">
        {t('app.skipToContent')}
      </a>

      <PageHeader title={t('app.name')} subtitle={t('app.subtitle')} />

      <main className="hr-main">
        <section className="hr-hero" aria-labelledby="main-content">
          <p className="hr-hero__eyebrow">HR Hunter v2.0 • Supabase PostgreSQL</p>
          <h1 id="main-content" tabIndex={-1} className="hr-hero__heading">
            {t('app.name')}
          </h1>
          <h2 className="hr-hero__subheading">{t('phase1.heading')}</h2>
          <p className="hr-hero__description">{t('phase1.description')}</p>
        </section>

        <section className="hr-grid" aria-label={t('phase1.heading')}>
          <article className="hr-card">
            <div className="hr-card__body">
              <div className="hr-card__header">
                <h3 className="hr-card__title">{t('phase1.apiHealthLabel')}</h3>
                <Database size={20} strokeWidth={2} className="hr-card__icon" aria-hidden="true" />
              </div>
              <StatusBadge
                status={badgeVariant}
                label={badgeLabel}
                testId="supabase-health-badge"
              />
              {healthData && connectionState === 'connected' ? (
                <p className="hr-card__meta">
                  {healthData.service} • {healthData.latencyMs}ms
                </p>
              ) : null}
            </div>
            <div className="hr-card__footer">
              <Button
                variant="ghost"
                icon={<RefreshCw size={16} strokeWidth={2} />}
                onClick={() => {
                  void loadHealth();
                }}
              >
                {t('common.refresh')}
              </Button>
            </div>
          </article>

          <article className="hr-card">
            <div className="hr-card__body">
              <div className="hr-card__header">
                <h3 className="hr-card__title">{t('phase1.designSystemLabel')}</h3>
                <Palette size={20} strokeWidth={2} className="hr-card__icon" aria-hidden="true" />
              </div>
              <p className="hr-card__value">{t('phase1.designSystemStatus')}</p>
            </div>
            <div className="hr-card__footer">
              <StatusBadge status="success" label={t('status.active')} />
            </div>
          </article>

          <article className="hr-card">
            <div className="hr-card__body">
              <div className="hr-card__header">
                <h3 className="hr-card__title">{t('phase1.nextPhaseLabel')}</h3>
                <Layers size={20} strokeWidth={2} className="hr-card__icon" aria-hidden="true" />
              </div>
              <p className="hr-card__value">{t('phase1.nextPhaseValue')}</p>
            </div>
            <div className="hr-card__footer">
              <StatusBadge status="neutral" label={t('status.pending')} />
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

export default App;
