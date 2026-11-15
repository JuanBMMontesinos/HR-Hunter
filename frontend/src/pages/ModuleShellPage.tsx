import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '../components/common/StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

export interface ModuleShellPageProps {
  titleKey: string;
  subtitleKey: string;
  moduleKey: string;
}

export function ModuleShellPage({ titleKey, subtitleKey, moduleKey }: ModuleShellPageProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { permissions } = usePermissions();

  return (
    <section className="hr-page-section" data-module={moduleKey}>
      <div className="hr-page-heading">
        <div>
          <h1 className="hr-page-heading__title">{t(titleKey)}</h1>
          <p className="hr-page-heading__subtitle">{t(subtitleKey)}</p>
        </div>
        {user ? <StatusBadge status="info" label={user.role} /> : null}
      </div>

      <article className="hr-card hr-module-shell">
        <div className="hr-module-shell__intro">
          <ShieldCheck size={20} className="hr-module-shell__icon" aria-hidden="true" />
          <p>{t('pages.moduleReady')}</p>
        </div>

        <div>
          <h2 className="hr-module-shell__perms-title">{t('pages.currentPermissions')}</h2>
          <div className="hr-module-shell__perms-list">
            {permissions.map((perm) => (
              <span key={perm} className="hr-perm-chip">
                {perm}
              </span>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}
