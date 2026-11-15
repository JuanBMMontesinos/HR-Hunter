import { Briefcase, Database } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LoginForm } from '../../components/auth/LoginForm';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { fetchHealthStatus } from '../../services/api';

type HealthState = 'checking' | 'connected' | 'disconnected';

interface LoginLocationState {
  from?: { pathname?: string; search?: string };
  sessionExpired?: boolean;
}

export function Login() {
  const { t } = useTranslation();
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [health, setHealth] = useState<HealthState>('checking');

  const locationState = (location.state ?? {}) as LoginLocationState;
  const fromPath =
    locationState.from?.pathname &&
    locationState.from.pathname !== '/login' &&
    locationState.from.pathname !== '/'
      ? `${locationState.from.pathname}${locationState.from.search ?? ''}`
      : '/dashboard';

  useEffect(() => {
    let active = true;
    fetchHealthStatus()
      .then((res) => {
        if (!active) return;
        setHealth(res.data?.database === 'connected' ? 'connected' : 'disconnected');
      })
      .catch(() => {
        if (!active) return;
        setHealth('disconnected');
      });

    return () => {
      active = false;
    };
  }, []);

  if (!loading && isAuthenticated) {
    return <Navigate to={fromPath} replace />;
  }

  const badgeTone =
    health === 'connected' ? 'success' : health === 'disconnected' ? 'danger' : 'warning';
  const badgeLabel =
    health === 'connected'
      ? t('status.connected')
      : health === 'disconnected'
        ? t('status.disconnected')
        : t('status.checking');

  return (
    <div className="hr-auth-page">
      <header className="hr-auth-topbar">
        <div className="hr-brand">
          <div className="hr-brand__mark" aria-hidden="true">
            <Briefcase size={20} strokeWidth={2} />
          </div>
          <div>
            <p className="hr-brand__title">{t('app.name')}</p>
            <p className="hr-brand__subtitle">{t('app.subtitle')}</p>
          </div>
        </div>
        <div className="hr-auth-topbar__right">
          <StatusBadge
            status={badgeTone}
            label={badgeLabel}
            testId="supabase-health-badge"
          />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="hr-auth-main" id="main-content">
        <section className="hr-auth-card hr-card" aria-labelledby="login-heading">
          <div className="hr-auth-card__header">
            <h1 id="login-heading" className="hr-auth-card__title">
              {t('auth.loginTitle')}
            </h1>
            <p className="hr-auth-card__subtitle">{t('auth.loginSubtitle')}</p>
          </div>

          <LoginForm
            sessionExpiredNotice={Boolean(locationState.sessionExpired)}
            onSuccess={() => navigate(fromPath, { replace: true })}
          />

          <div className="hr-auth-card__footer">
            <Database size={14} aria-hidden="true" />
            <span>{badgeLabel}</span>
          </div>
        </section>
      </main>
    </div>
  );
}
