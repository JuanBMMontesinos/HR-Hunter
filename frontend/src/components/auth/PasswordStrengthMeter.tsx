import { CheckCircle2, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { evaluatePasswordStrength } from '../../utils/passwordPolicy';

export interface PasswordStrengthMeterProps {
  password: string;
  minLength?: number;
}

export function PasswordStrengthMeter({ password, minLength = 8 }: PasswordStrengthMeterProps) {
  const { t } = useTranslation();
  const result = evaluatePasswordStrength(password, minLength);

  const level =
    result.score >= 5 ? 'strong' : result.score >= 3 ? 'medium' : 'weak';

  const ruleItems = [
    {
      key: 'minLength',
      met: result.rules.minLength,
      text: t('auth.passwordRules.minLength', { count: result.minLength }),
    },
    {
      key: 'uppercase',
      met: result.rules.uppercase,
      text: t('auth.passwordRules.uppercase'),
    },
    {
      key: 'lowercase',
      met: result.rules.lowercase,
      text: t('auth.passwordRules.lowercase'),
    },
    {
      key: 'number',
      met: result.rules.number,
      text: t('auth.passwordRules.number'),
    },
    {
      key: 'special',
      met: result.rules.special,
      text: t('auth.passwordRules.special'),
    },
  ];

  return (
    <div className="hr-password-meter" aria-live="polite">
      <div className="hr-password-meter__bar-row">
        <span className="hr-password-meter__label">
          {t('auth.passwordRules.strengthLabel')}{' '}
          <strong className={`hr-password-meter__badge is-${level}`}>
            {t(`auth.passwordRules.${level}`)}
          </strong>
        </span>
        <span className="hr-password-meter__score">
          {result.score}/{result.maxScore}
        </span>
      </div>

      <div className="hr-password-meter__track" aria-hidden="true">
        <div
          className={`hr-password-meter__fill is-${level}`}
          style={{ width: `${(result.score / result.maxScore) * 100}%` }}
        />
      </div>

      <p className="hr-password-meter__rules-title">{t('auth.passwordRulesTitle')}</p>
      <ul className="hr-password-meter__rules">
        {ruleItems.map((rule) => (
          <li
            key={rule.key}
            className={['hr-password-meter__rule', rule.met ? 'is-met' : 'is-unmet'].join(' ')}
          >
            {rule.met ? (
              <CheckCircle2 size={15} aria-hidden="true" />
            ) : (
              <Circle size={15} aria-hidden="true" />
            )}
            <span>{rule.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
