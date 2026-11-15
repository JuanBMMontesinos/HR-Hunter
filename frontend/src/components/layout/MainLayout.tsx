import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function MainLayout() {
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className={['hr-layout', sidebarCollapsed ? 'hr-layout--collapsed' : ''].filter(Boolean).join(' ')}
    >
      <a href="#main-content" className="hr-skip-link">
        {t('app.skipToContent')}
      </a>

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="hr-layout__body">
        <Header
          mobileMenuOpen={mobileMenuOpen}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main id="main-content" className="hr-main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
