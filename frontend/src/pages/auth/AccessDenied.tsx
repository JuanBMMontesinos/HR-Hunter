import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

interface AccessDeniedState {
  resource?: string;
}

export function AccessDenied() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const location = useLocation();
  const state = (location.state ?? {}) as AccessDeniedState;

  const fallbackTarget = !isAuthenticated
    ? '/login'
    : can('dashboard', 'read')
      ? '/dashboard'
      : '/profile';

  return (
    <div className="hr-access-denied" role="region" aria-labelledby="access-denied-title">
      <div className="hr-card hr-access-denied__card">
        <div className="hr-access-denied__icon" aria-hidden="true">
          <ShieldAlert size={36} />
        </div>
        <h1 id="access-denied-title" className="hr-access-denied__title">
          {t('auth.accessDeniedTitle')}
        </h1>
        <p className="hr-access-denied__description">
          {t('auth.accessDeniedDescription', { role: user?.role ?? 'Guest' })}
        </p>
        {state.resource ? (
          <p className="hr-access-denied__resource">
            {t('auth.accessDeniedResource', { resource: state.resource })}
          </p>
        ) : null}
        <Link to={fallbackTarget} className="hr-btn hr-btn--solid">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{t('auth.backToDashboard')}</span>
        </Link>
      </div>
    </div>
  );
}
