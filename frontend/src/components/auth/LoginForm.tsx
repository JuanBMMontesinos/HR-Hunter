import { AlertTriangle, Lock, LogIn, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { parseApiError } from '../../services/api';
import type { UserDto } from '../../types/auth';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

export interface LoginFormProps {
  onSuccess?: (user: UserDto) => void;
  sessionExpiredNotice?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ onSuccess, sessionExpiredNotice = false }: LoginFormProps) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emailError =
    touched.email && !EMAIL_REGEX.test(email.trim()) ? t('auth.emailInvalid') : null;
  const passwordError =
    touched.password && password.length === 0 ? t('auth.passwordRequired') : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ email: true, password: true });
    setFormError(null);

    const normalizedEmail = email.trim();
    if (!EMAIL_REGEX.test(normalizedEmail) || password.length === 0) {
      return;
    }

    setSubmitting(true);
    try {
      const session = await login({ email: normalizedEmail, password });
      onSuccess?.(session.user);
    } catch (error) {
      const parsed = parseApiError(error);
      let message = t('auth.invalidCredentials');

      if (parsed.status === 423 || parsed.code === 'AUTH_004') {
        message = t('auth.lockoutMessage');
      } else if (parsed.status === 429 || parsed.code === 'AUTH_RATE_LIMIT') {
        message = t('auth.rateLimitMessage');
      } else if (parsed.status === 403) {
        message = t('auth.inactiveAccount');
      } else if (parsed.status === 401 || parsed.code === 'AUTH_001') {
        message = t('auth.invalidCredentials');
      } else if (parsed.message) {
        message = parsed.message;
      }

      setFormError(message);
      showToast({
        variant: 'danger',
        title: t('common.error'),
        message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="hr-login-form" onSubmit={handleSubmit} noValidate>
      {sessionExpiredNotice && !formError ? (
        <div className="hr-alert hr-alert--warning" role="status">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{t('auth.sessionExpired')}</span>
        </div>
      ) : null}

      {formError ? (
        <div className="hr-alert hr-alert--danger" role="alert" data-testid="login-error-alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{formError}</span>
        </div>
      ) : null}

      <Input
        name="email"
        type="email"
        label={t('auth.emailLabel')}
        hint={t('auth.emailHint')}
        placeholder={t('auth.emailPlaceholder')}
        autoComplete="username"
        spellCheck={false}
        autoCapitalize="none"
        required
        leadingIcon={<Mail size={18} />}
        value={email}
        error={emailError}
        onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
        onChange={(event) => {
          setEmail(event.target.value);
          if (formError) setFormError(null);
        }}
      />

      <Input
        name="password"
        type="password"
        label={t('auth.passwordLabel')}
        placeholder={t('auth.passwordPlaceholder')}
        autoComplete="current-password"
        allowPasswordToggle
        required
        leadingIcon={<Lock size={18} />}
        value={password}
        error={passwordError}
        onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
        onChange={(event) => {
          setPassword(event.target.value);
          if (formError) setFormError(null);
        }}
      />

      <div className="hr-login-form__links">
        <Link to="/forgot-password" className="hr-link">
          {t('auth.forgotPasswordLink')}
        </Link>
      </div>

      <Button
        type="submit"
        variant="solid"
        disabled={submitting}
        className="hr-btn--full"
        icon={<LogIn size={18} />}
      >
        {submitting ? t('auth.submittingLogin') : t('auth.submitLogin')}
      </Button>
    </form>
  );
}
