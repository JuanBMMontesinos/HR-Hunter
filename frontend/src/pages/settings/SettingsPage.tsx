import { Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tabs } from '../../components/common/Tabs';
import { AuditLogTab } from '../../components/settings/AuditLogTab';
import { BackupSnapshotTab } from '../../components/settings/BackupSnapshotTab';
import { EmailTemplatesTab } from '../../components/settings/EmailTemplatesTab';
import { GeneralSettingsTab } from '../../components/settings/GeneralSettingsTab';
import { LoginHistoryTab } from '../../components/settings/LoginHistoryTab';
import { PermissionsManagerTab } from '../../components/settings/PermissionsManagerTab';
import { SecurityAndRetentionTab } from '../../components/settings/SecurityAndRetentionTab';
import { SecurityDashboardTab } from '../../components/settings/SecurityDashboardTab';
import { StagesAndFunnelsTab } from '../../components/settings/StagesAndFunnelsTab';

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="hr-page" data-testid="settings-page">
      <div className="hr-page-heading">
        <h1 className="hr-page-heading__title">
          <Settings size={24} className="hr-inline-icon" aria-hidden="true" />
          {t('settings.title')}
        </h1>
        <p className="hr-page-heading__subtitle">{t('pages.settingsSubtitle')}</p>
      </div>

      <Tabs
        label={t('settings.tabsLabel')}
        selectionMode="activation"
        testIdPrefix="settings-tab"
        items={[
          {
            id: 'general',
            label: t('settings.tabs.general'),
            content: <GeneralSettingsTab />,
          },
          {
            id: 'stages',
            label: t('settings.tabs.stages'),
            content: <StagesAndFunnelsTab />,
          },
          {
            id: 'email',
            label: t('settings.tabs.email'),
            content: <EmailTemplatesTab />,
          },
          {
            id: 'security-retention',
            label: t('settings.tabs.securityRetention'),
            content: <SecurityAndRetentionTab />,
          },
          {
            id: 'audit-log',
            label: t('settings.tabs.auditLog'),
            content: <AuditLogTab />,
          },
          {
            id: 'login-history',
            label: t('settings.tabs.loginHistory'),
            content: <LoginHistoryTab />,
          },
          {
            id: 'security-dashboard',
            label: t('settings.tabs.securityDashboard'),
            content: <SecurityDashboardTab />,
          },
          {
            id: 'permissions',
            label: t('settings.tabs.permissions'),
            content: <PermissionsManagerTab />,
          },
          {
            id: 'backup',
            label: t('settings.tabs.backup'),
            content: <BackupSnapshotTab />,
          },
        ]}
      />
    </div>
  );
}
