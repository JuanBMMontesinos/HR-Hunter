import { useTranslation } from 'react-i18next';

const SUPPORTED_LANGUAGES = [
  { code: 'pt-BR', label: 'PT-BR' },
  { code: 'en-US', label: 'EN-US' },
] as const;

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language || 'pt-BR';

  const handleLanguageChange = async (lang: string) => {
    await i18n.changeLanguage(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('hr_hunter_lang', lang);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  };

  return (
    <div className="hr-lang-switcher" role="group" aria-label={t('common.language')}>
      {SUPPORTED_LANGUAGES.map(({ code, label }) => {
        const isActive = currentLang === code;
        return (
          <button
            key={code}
            type="button"
            className="hr-lang-pill"
            aria-pressed={isActive}
            onClick={() => {
              void handleLanguageChange(code);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
