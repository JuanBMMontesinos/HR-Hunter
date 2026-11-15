import {
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  LayoutDashboard,
  Settings,
  UserCog,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import type { PermissionAction, PermissionResource } from '../../types/auth';

export interface SidebarNavItem {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  permission?: [PermissionResource, PermissionAction];
}

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  {
    to: '/dashboard',
    labelKey: 'nav.dashboard',
    icon: LayoutDashboard,
    permission: ['dashboard', 'read'],
  },
  {
    to: '/companies',
    labelKey: 'nav.companies',
    icon: Building2,
    permission: ['companies', 'read'],
  },
  {
    to: '/job-openings',
    labelKey: 'nav.jobOpenings',
    icon: Briefcase,
    permission: ['job_openings', 'read'],
  },
  {
    to: '/candidates',
    labelKey: 'nav.candidates',
    icon: Users,
    permission: ['candidates', 'read'],
  },
  {
    to: '/processes',
    labelKey: 'nav.processes',
    icon: GitBranch,
    permission: ['processes', 'read'],
  },
  {
    to: '/users',
    labelKey: 'nav.users',
    icon: UserCog,
    permission: ['users', 'read'],
  },
  {
    to: '/settings',
    labelKey: 'nav.settings',
    icon: Settings,
    permission: ['settings', 'read'],
  },
  {
    to: '/profile',
    labelKey: 'nav.profile',
    icon: UserRound,
  },
];

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function isOutsideRect(event: PointerEvent<HTMLDialogElement>, dialog: HTMLDialogElement): boolean {
  const rect = dialog.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const drawerId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pointerDownOutsideRef = useRef(false);

  const visibleItems = useMemo(
    () =>
      SIDEBAR_NAV_ITEMS.filter((item) =>
        item.permission ? can(item.permission[0], item.permission[1]) : true,
      ),
    [can],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (mobileOpen && !dialog.open) {
      dialog.returnValue = '';
      dialog.showModal();
    } else if (!mobileOpen && dialog.open) {
      dialog.close();
      dialog.returnValue = '';
    }
  }, [mobileOpen]);

  const renderLinks = (isCompact: boolean, onNavigate?: () => void) => (
    <ul className="hr-sidebar__list">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const label = t(item.labelKey);
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
              title={isCompact ? label : undefined}
              className={({ isActive }) =>
                ['hr-sidebar__link', isActive ? 'is-active' : ''].filter(Boolean).join(' ')
              }
            >
              <Icon size={20} className="hr-sidebar__link-icon" aria-hidden="true" />
              {!isCompact ? <span className="hr-sidebar__link-text">{label}</span> : (
                <span className="visually-hidden">{label}</span>
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <aside
        className={['hr-sidebar', collapsed ? 'hr-sidebar--collapsed' : ''].filter(Boolean).join(' ')}
        data-testid="desktop-sidebar"
      >
        <div className="hr-sidebar__top">
          <div className="hr-sidebar__brand">
            <div className="hr-brand__mark hr-brand__mark--sm" aria-hidden="true">
              <Briefcase size={18} strokeWidth={2.2} />
            </div>
            {!collapsed ? <span className="hr-sidebar__brand-name">{t('app.name')}</span> : null}
          </div>
          <button
            type="button"
            className="hr-sidebar__collapse-btn"
            aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            aria-expanded={!collapsed}
            onClick={onToggleCollapse}
          >
            {collapsed ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}
          </button>
        </div>

        <nav className="hr-sidebar__nav" aria-label={t('nav.sidebarLabel')}>
          {renderLinks(collapsed)}
        </nav>
      </aside>

      <dialog
        ref={dialogRef}
        id={drawerId}
        aria-label={t('nav.sidebarLabel')}
        className="hr-drawer-dialog"
        onClose={() => {
          if (dialogRef.current) {
            dialogRef.current.returnValue = '';
          }
          onCloseMobile();
        }}
        onPointerDown={(event) => {
          const dialog = dialogRef.current;
          if (!dialog) return;
          pointerDownOutsideRef.current = isOutsideRect(event, dialog);
        }}
        onPointerUp={(event) => {
          const dialog = dialogRef.current;
          if (!dialog) return;
          if (pointerDownOutsideRef.current && isOutsideRect(event, dialog)) {
            dialog.close();
          }
          pointerDownOutsideRef.current = false;
        }}
      >
        <div className="hr-drawer-dialog__header">
          <div className="hr-sidebar__brand">
            <div className="hr-brand__mark hr-brand__mark--sm" aria-hidden="true">
              <Briefcase size={18} strokeWidth={2.2} />
            </div>
            <span className="hr-sidebar__brand-name">{t('app.name')}</span>
          </div>
          <button
            type="button"
            className="hr-modal__close"
            aria-label={t('nav.closeMenu')}
            onClick={() => dialogRef.current?.close()}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="hr-sidebar__nav" aria-label={t('nav.sidebarLabel')}>
          {renderLinks(false, () => dialogRef.current?.close())}
        </nav>
      </dialog>
    </>
  );
}
