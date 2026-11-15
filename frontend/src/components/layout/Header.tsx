import { Bell, Check, LogOut, Menu, UserRound } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/api';
import type { NotificationItem } from '../../types/auth';
import { LanguageSwitcher } from '../common/LanguageSwitcher';

export interface HeaderProps {
  onOpenMobileMenu: () => void;
  mobileMenuOpen: boolean;
}

export function Header({ onOpenMobileMenu, mobileMenuOpen }: HeaderProps) {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifPanelId = useId();
  const userMenuPanelId = useId();

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await fetchNotifications({ limit: 8 });
      setNotifications(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
    } catch {
      // Keep header resilient if notifications endpoint is temporarily unreachable
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore transient mark-read failure
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore transient mark-all failure
    }
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    showToast({ variant: 'info', message: t('auth.logoutSuccess') });
    navigate('/login', { replace: true });
  };

  return (
    <header className="hr-topbar">
      <div className="hr-topbar__left">
        <button
          type="button"
          className="hr-topbar__menu-btn"
          aria-label={t('nav.openMenu')}
          aria-expanded={mobileMenuOpen}
          onClick={onOpenMobileMenu}
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <span className="hr-topbar__workspace-label">{t('app.subtitle')}</span>
      </div>

      <div className="hr-topbar__right">
        <div className="hr-popover-anchor" ref={notifRef}>
          <button
            type="button"
            className="hr-icon-btn"
            aria-label={t('header.notifications')}
            aria-expanded={notifOpen}
            aria-controls={notifPanelId}
            onClick={() => {
              const next = !notifOpen;
              setNotifOpen(next);
              setUserMenuOpen(false);
              if (next) {
                void loadNotifications();
              }
            }}
          >
            <Bell size={18} aria-hidden="true" />
            {unreadCount > 0 ? (
              <span className="hr-icon-btn__badge" aria-label={t('header.unreadCount', { count: unreadCount })}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </button>

          {notifOpen ? (
            <div id={notifPanelId} className="hr-popover hr-popover--wide">
              <div className="hr-popover__header">
                <strong>{t('header.notifications')}</strong>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    className="hr-link-btn"
                    onClick={() => void handleMarkAllRead()}
                  >
                    {t('header.markAllRead')}
                  </button>
                ) : null}
              </div>

              {notifications.length === 0 ? (
                <p className="hr-popover__empty">{t('header.noNotifications')}</p>
              ) : (
                <ul className="hr-notif-list">
                  {notifications.map((item) => (
                    <li
                      key={item.id}
                      className={['hr-notif-item', item.isRead ? 'is-read' : 'is-unread'].join(' ')}
                    >
                      <div className="hr-notif-item__body">
                        <p className="hr-notif-item__title">{item.title}</p>
                        <p className="hr-notif-item__message">{item.message}</p>
                      </div>
                      {!item.isRead ? (
                        <button
                          type="button"
                          className="hr-notif-item__read-btn"
                          aria-label={t('header.markRead')}
                          onClick={() => void handleMarkRead(item.id)}
                        >
                          <Check size={14} aria-hidden="true" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        <LanguageSwitcher />

        {user ? (
          <div className="hr-popover-anchor" ref={userMenuRef}>
            <button
              type="button"
              className="hr-user-trigger"
              aria-label={t('header.userMenu')}
              aria-expanded={userMenuOpen}
              aria-controls={userMenuPanelId}
              onClick={() => {
                setUserMenuOpen((prev) => !prev);
                setNotifOpen(false);
              }}
            >
              <span className="hr-user-trigger__avatar" aria-hidden="true">
                {user.fullName.charAt(0).toUpperCase()}
              </span>
              <span className="hr-user-trigger__meta">
                <span className="hr-user-trigger__name">{user.fullName}</span>
                <span className="hr-user-trigger__role">{user.role}</span>
              </span>
            </button>

            {userMenuOpen ? (
              <div id={userMenuPanelId} className="hr-popover">
                <p className="hr-popover__meta">
                  {t('header.signedInAs', { role: user.role })}
                </p>
                <Link
                  to="/profile"
                  className="hr-popover__item"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <UserRound size={16} aria-hidden="true" />
                  <span>{t('nav.profile')}</span>
                </Link>
                <button
                  type="button"
                  className="hr-popover__item hr-popover__item--danger"
                  onClick={() => void handleLogout()}
                >
                  <LogOut size={16} aria-hidden="true" />
                  <span>{t('nav.logout')}</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
