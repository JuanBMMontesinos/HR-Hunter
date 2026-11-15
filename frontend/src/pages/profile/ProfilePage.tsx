import { UserCog } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { parseApiError } from '../../services/api';
import { getUserActivity, updateUser } from '../../services/userService';
import type { UserActivityData } from '../../types/domain';
import { formatDateTime, formatPhone } from '../../utils/formatters';

export function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, refreshToken } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(formatPhone(user?.phone));
  const [preferredLanguage, setPreferredLanguage] = useState<'pt-BR' | 'en-US'>(
    (user?.preferredLanguage as 'pt-BR' | 'en-US') || 'pt-BR',
  );
  const [saving, setSaving] = useState(false);
  const [activity, setActivity] = useState<UserActivityData | null>(null);

  const loadActivity = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await getUserActivity(user.id);
      setActivity(res);
      setFullName(res.user.fullName);
      setPhone(formatPhone(res.user.phone));
      setPreferredLanguage((res.user.preferredLanguage as 'pt-BR' | 'en-US') || 'pt-BR');
    } catch {
      // Fall back silently to current AuthContext user
    }
  }, [user?.id]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setSaving(true);
    try {
      await updateUser(user.id, {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        preferredLanguage,
      });
      await i18n.changeLanguage(preferredLanguage);
      await refreshToken().catch(() => null);
      showToast({ variant: 'success', message: t('profile.saveSuccess') });
    } catch (err) {
      showToast({ variant: 'danger', message: parseApiError(err).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hr-page" data-testid="profile-page">
      <div className="hr-page-heading">
        <h1 className="hr-page-heading__title">
          <UserCog size={24} className="hr-inline-icon" aria-hidden="true" />
          {t('profile.title')}
        </h1>
        <p className="hr-page-heading__subtitle">{t('pages.profileSubtitle')}</p>
      </div>

      <section className="hr-card hr-section-card">
        <div className="hr-detail-banner">
          <h2>{t('profile.personalInfo')}</h2>
          <StatusBadge status="info" label={`${t('profile.roleReadOnly')}: ${user?.role || ''}`} />
        </div>

        <form className="hr-form-grid" onSubmit={(e) => void handleSave(e)}>
          <Input label={t('users.email')} value={user?.email || ''} disabled />
          <Input
            label={t('users.fullName')}
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            label={t('users.phone')}
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
          />
          <Select
            label={t('profile.preferredLanguage')}
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value as 'pt-BR' | 'en-US')}
            options={[
              { value: 'pt-BR', label: 'Português (Brasil)' },
              { value: 'en-US', label: 'English (US)' },
            ]}
          />
          <div className="hr-form-full">
            <Button type="submit" disabled={saving} data-testid="profile-save-btn">
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        </form>
      </section>

      {activity ? (
        <section className="hr-card hr-section-card">
          <h2>{t('profile.myActivity')}</h2>
          <ul className="hr-simple-list">
            {activity.recentLogins.slice(0, 5).map((item) => (
              <li key={item.id}>
                {formatDateTime(item.loginTime, i18n.language)} —{' '}
                {item.isSuccessful ? t('settings.loginHistory.successLabel') : t('settings.loginHistory.failureLabel')}{' '}
                ({item.ipAddress || '—'})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
