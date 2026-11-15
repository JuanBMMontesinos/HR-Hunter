import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useToast } from '../../contexts/ToastContext';
import { parseApiError } from '../../services/api';
import { getSystemSettings, updateSystemSettings } from '../../services/settingsService';
import type { SystemConfigItem } from '../../types/domain';

const GENERAL_CATEGORIES = new Set(['General', 'System', 'Appearance', 'Notifications']);

export function GeneralSettingsTab() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [items, setItems] = useState<SystemConfigItem[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSystemSettings();
      const filtered = data.items.filter(
        (item) => GENERAL_CATEGORIES.has(item.category) || (!item.category && !item.configKey.startsWith('Smtp') && !item.configKey.startsWith('Retention')),
      );
      setItems(filtered);
      const map: Record<string, string> = {};
      for (const item of filtered) {
        map[item.configKey] = item.isSensitive ? '********' : item.configValue ?? '';
      }
      setValues(map);
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const configs = items
        .filter((item) => !(item.isSensitive && values[item.configKey] === '********'))
        .map((item) => ({
          configKey: item.configKey,
          configValue: values[item.configKey] ?? '',
          dataType: item.dataType,
          category: item.category,
          isSensitive: Boolean(item.isSensitive),
        }));

      await updateSystemSettings(configs);
      showToast({ variant: 'success', message: t('settings.general.savedSuccess') });
      await load();
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>{t('common.loading')}</p>;

  return (
    <form className="hr-card hr-section-card hr-detail-stack" onSubmit={(e) => void handleSubmit(e)}>
      <div className="hr-form-grid">
        {items.map((item) => (
          <Input
            key={item.configKey}
            label={item.description || item.configKey}
            hint={`${item.configKey} (${item.category})`}
            type={item.isSensitive ? 'password' : 'text'}
            value={values[item.configKey] ?? ''}
            placeholder={item.isSensitive ? t('settings.general.sensitivePlaceholder') : undefined}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                [item.configKey]: e.target.value,
              }))
            }
          />
        ))}
      </div>
      <div>
        <Button type="submit" disabled={saving || items.length === 0} data-testid="general-settings-save">
          {saving ? t('common.saving') : t('settings.general.saveConfigs')}
        </Button>
      </div>
    </form>
  );
}
