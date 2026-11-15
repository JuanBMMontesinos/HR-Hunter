import { Briefcase } from 'lucide-react';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from './LanguageSwitcher';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="hr-header">
      <div className="hr-header__inner">
        <div className="hr-brand">
          <div className="hr-brand__mark" aria-hidden="true">
            <Briefcase size={22} strokeWidth={2} />
          </div>
          <div>
            <p className="hr-brand__title">{title}</p>
            {subtitle ? <p className="hr-brand__subtitle">{subtitle}</p> : null}
          </div>
        </div>
        <div className="hr-header__actions">
          {actions}
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
