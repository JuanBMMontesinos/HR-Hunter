import { Play, Shield } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { ConfirmModal } from '../common/ConfirmModal';
import { Input } from '../common/Input';
import { useToast } from '../../contexts/ToastContext';
import { parseApiError } from '../../services/api';
import {
  executeRetention,
  listRetentionHistory,
  listRetentionPolicies,
  updateRetentionPolicy,
} from '../../services/securityAdminService';
import { getSystemSettings, updateSystemSettings } from '../../services/settingsService';
import type { RetentionExecutionLog, RetentionPolicy, SystemConfigItem } from '../../types/domain';
import { formatDateTime } from '../../utils/formatters';

export function SecurityAndRetentionTab() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  const [secConfigs, setSecConfigs] = useState<SystemConfigItem[]>([]);
  const [secValues, setSecValues] = useState<Record<string, string>>({});
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [policyDays, setPolicyDays] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<RetentionExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmExecuteOpen, setConfirmExecuteOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, pols, hist] = await Promise.all([
        getSystemSettings(),
        listRetentionPolicies(),
        listRetentionHistory({ limit: 10 }),
      ]);
      const sec = settings.items.filter((i) => i.category === 'Security');
      setSecConfigs(sec);
      const secMap: Record<string, string> = {};
      for (const s of sec) secMap[s.configKey] = s.configValue ?? '';
      setSecValues(secMap);

      setPolicies(pols);
      const dayMap: Record<string, string> = {};
      for (const p of pols) dayMap[p.configKey] = String(p.days);
      setPolicyDays(dayMap);

      setHistory(hist.items);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSaveSecurity = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await updateSystemSettings(
        secConfigs.map((c) => ({
          configKey: c.configKey,
          configValue: secValues[c.configKey] ?? '',
          dataType: c.dataType,
          category: c.category,
        })),
      );
      showToast({ variant: 'success', message: t('settings.general.savedSuccess') });
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    }
  };

  const handleUpdatePolicy = async (key: string) => {
    const days = Number(policyDays[key]);
    if (!Number.isFinite(days) || days < 1) return;
    try {
      await updateRetentionPolicy(key, days);
      showToast({ variant: 'success', message: t('settings.retention.policyUpdated') });
      await loadAll();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    }
  };

  const handleRunRetention = async (dryRun: boolean) => {
    try {
      const res = await executeRetention(dryRun);
      showToast({
        variant: 'info',
        message: dryRun
          ? t('settings.retention.dryRunResult', { count: res.recordsDeleted })
          : t('settings.retention.executeResult', { count: res.recordsDeleted }),
      });
      setConfirmExecuteOpen(false);
      await loadAll();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    }
  };

  if (loading) return <p>{t('common.loading')}</p>;

  return (
    <div className="hr-detail-stack">
      <section className="hr-card hr-section-card hr-detail-stack">
        <h2 className="hr-chart-card__title">
          <Shield size={18} className="hr-inline-icon" aria-hidden="true" />
          {t('settings.retention.securityPoliciesTitle')}
        </h2>
        <form className="hr-form-grid" onSubmit={(e) => void handleSaveSecurity(e)}>
          {secConfigs.map((item) => (
            <Input
              key={item.configKey}
              label={item.description || item.configKey}
              value={secValues[item.configKey] ?? ''}
              onChange={(e) =>
                setSecValues((prev) => ({ ...prev, [item.configKey]: e.target.value }))
              }
            />
          ))}
          <div className="hr-form-full">
            <Button type="submit" size="sm">
              {t('settings.general.saveConfigs')}
            </Button>
          </div>
        </form>
      </section>

      <section className="hr-card hr-section-card hr-detail-stack">
        <header className="hr-chart-card__head">
          <h2 className="hr-chart-card__title">{t('settings.retention.retentionPoliciesTitle')}</h2>
          <div className="hr-row-actions">
            <Button
              size="sm"
              variant="neutral"
              icon={<Play size={14} />}
              onClick={() => void handleRunRetention(true)}
            >
              {t('settings.retention.runDryRun')}
            </Button>
            <Button size="sm" variant="danger" onClick={() => setConfirmExecuteOpen(true)}>
              {t('settings.retention.runExecute')}
            </Button>
          </div>
        </header>

        <div className="hr-table-scroll">
          <table className="hr-mini-table">
            <thead>
              <tr>
                <th>Política</th>
                <th>{t('settings.retention.retentionDays')}</th>
                <th>{t('settings.retention.eligibleRows')}</th>
                <th>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.configKey}>
                  <td>
                    <code>{p.configKey}</code>
                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      className="hr-input hr-input--compact"
                      aria-label={p.configKey}
                      value={policyDays[p.configKey] ?? String(p.days)}
                      onChange={(e) =>
                        setPolicyDays((prev) => ({ ...prev, [p.configKey]: e.target.value }))
                      }
                    />
                  </td>
                  <td>{p.eligibleForCleanup}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={() => void handleUpdatePolicy(p.configKey)}>
                      {t('common.save')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>{t('settings.retention.historyTitle')}</h3>
        <ul className="hr-simple-list">
          {history.map((h) => (
            <li key={h.id}>
              {formatDateTime(h.executedAt, i18n.language)} — {h.executedByName || 'Cron'} —{' '}
              <strong>{h.recordsDeleted}</strong> registros
            </li>
          ))}
        </ul>
      </section>

      <ConfirmModal
        open={confirmExecuteOpen}
        title={t('settings.retention.runExecute')}
        message="Executar a remoção definitiva de registros antigos elegíveis conforme as políticas de retenção?"
        confirmLabel={t('common.confirm')}
        onConfirm={() => handleRunRetention(false)}
        onClose={() => setConfirmExecuteOpen(false)}
      />
    </div>
  );
}
