import { AlertTriangle, ArrowLeft, Briefcase, CheckCircle2, KeyRound, Lock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { PasswordStrengthMeter } from '../../components/auth/PasswordStrengthMeter';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher';
import { parseApiError } from '../../services/api';
import { resetPasswordApi } from '../../services/authService';
import { evaluatePasswordStrength } from '../../utils/passwordPolicy';

export function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState({ token: false, password: false, confirm: false });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const strength = evaluatePasswordStrength(newPassword);
  const tokenError =
    touched.token && token.trim().length < 16 ? t('auth.tokenInvalid') : null;
  const confirmError =
    touched.confirm && confirmPassword !== newPassword
      ? t('auth.confirmPasswordMismatch')
      : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ token: true, password: true, confirm: true });
    setErrorMessage(null);

    if (token.trim().length < 16 || !strength.valid || confirmPassword !== newPassword) {
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordApi(token.trim(), newPassword);
      setCompleted(true);
    } catch (error) {
      const parsed = parseApiError(error);
      setErrorMessage(parsed.message);
    } finally {
      setSubmitting(false);
    }
  };

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
        <LanguageSwitcher />
      </header>

      <main className="hr-auth-main" id="main-content">
        <section className="hr-auth-card hr-card" aria-labelledby="reset-heading">
          <div className="hr-auth-card__header">
            <h1 id="reset-heading" className="hr-auth-card__title">
              {t('auth.resetTitle')}
            </h1>
            <p className="hr-auth-card__subtitle">{t('auth.resetSubtitle')}</p>
          </div>

          {completed ? (
            <div className="hr-stack-md">
              <div className="hr-alert hr-alert--success" role="status">
                <CheckCircle2 size={18} aria-hidden="true" />
                <span>{t('auth.resetSuccess')}</span>
              </div>
              <Link to="/login" className="hr-btn hr-btn--solid hr-btn--full">
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            <form className="hr-login-form" onSubmit={handleSubmit} noValidate>
              {errorMessage ? (
                <div className="hr-alert hr-alert--danger" role="alert">
                  <AlertTriangle size={18} aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              <Input
                name="token"
                type="text"
                label={t('auth.tokenLabel')}
                placeholder={t('auth.tokenPlaceholder')}
                required
                leadingIcon={<KeyRound size={18} />}
                value={token}
                error={tokenError}
                onBlur={() => setTouched((prev) => ({ ...prev, token: true }))}
                onChange={(event) => setToken(event.target.value)}
              />

              <PasswordStrengthMeter password={newPassword} />

              <Input
                name="newPassword"
                type="password"
                label={t('auth.newPasswordLabel')}
                autoComplete="new-password"
                allowPasswordToggle
                required
                leadingIcon={<Lock size={18} />}
                value={newPassword}
                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                onChange={(event) => setNewPassword(event.target.value)}
              />

              <Input
                name="confirmPassword"
                type="password"
                label={t('auth.confirmPasswordLabel')}
                autoComplete="new-password"
                allowPasswordToggle
                required
                leadingIcon={<Lock size={18} />}
                value={confirmPassword}
                error={confirmError}
                onBlur={() => setTouched((prev) => ({ ...prev, confirm: true }))}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />

              <Button
                type="submit"
                variant="solid"
                disabled={submitting}
                className="hr-btn--full"
              >
                {submitting ? t('common.loading') : t('auth.resetSubmit')}
              </Button>
            </form>
          )}

          {!completed ? (
            <div className="hr-auth-card__links-center">
              <Link to="/login" className="hr-link hr-link--with-icon">
                <ArrowLeft size={16} aria-hidden="true" />
                <span>{t('auth.backToLogin')}</span>
              </Link>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
