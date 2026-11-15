import { ArrowLeft, Briefcase, CheckCircle2, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher';
import { forgotPasswordApi } from '../../services/authService';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const emailError =
    touched && !EMAIL_REGEX.test(email.trim()) ? t('auth.emailInvalid') : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    const trimmed = email.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      return;
    }

    setSubmitting(true);
    try {
      await forgotPasswordApi(trimmed);
      setSubmitted(true);
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
        <section className="hr-auth-card hr-card" aria-labelledby="forgot-heading">
          <div className="hr-auth-card__header">
            <h1 id="forgot-heading" className="hr-auth-card__title">
              {t('auth.forgotTitle')}
            </h1>
            <p className="hr-auth-card__subtitle">{t('auth.forgotSubtitle')}</p>
          </div>

          {submitted ? (
            <div className="hr-alert hr-alert--success" role="status">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>{t('auth.forgotSuccess')}</span>
            </div>
          ) : (
            <form className="hr-login-form" onSubmit={handleSubmit} noValidate>
              <Input
                name="email"
                type="email"
                label={t('auth.emailLabel')}
                hint={t('auth.emailHint')}
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="username"
                spellCheck={false}
                required
                leadingIcon={<Mail size={18} />}
                value={email}
                error={emailError}
                onBlur={() => setTouched(true)}
                onChange={(event) => setEmail(event.target.value)}
              />

              <Button type="submit" variant="solid" disabled={submitting} className="hr-btn--full">
                {submitting ? t('common.loading') : t('auth.forgotSubmit')}
              </Button>
            </form>
          )}

          <div className="hr-auth-card__links-center">
            <Link to="/login" className="hr-link hr-link--with-icon">
              <ArrowLeft size={16} aria-hidden="true" />
              <span>{t('auth.backToLogin')}</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
