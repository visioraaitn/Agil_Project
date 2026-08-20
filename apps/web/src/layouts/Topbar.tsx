import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Shield,
  Sun,
  UserCog,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { EntityType } from '@visiora/shared';
import { Avatar } from '@/components/common/Avatar';
import { useAuth } from '@/features/auth/use-auth';
import {
  useMarkNotificationRead,
  useNotifications,
  useRealtimeNotifications,
} from '@/features/collaboration/hooks';
import { GlobalSearchBox } from '@/features/search/GlobalSearchBox';
import { useTheme } from '@/lib/use-theme';

const API_DOCS_URL =
  import.meta.env.VITE_API_DOCS_URL ??
  (import.meta.env.DEV ? 'http://localhost:3000/api/v1/docs' : null);

/** Barre superieure : recherche globale, notifications, compte. */
export function Topbar() {
  const { user, logout, isAdmin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { projectKey } = useParams<{ projectKey?: string }>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const { data: notifications } = useNotifications();
  useRealtimeNotifications(Boolean(user));
  const markRead = useMarkNotificationRead();
  const unreadCount = (notifications ?? []).filter((notification) => !notification.isRead).length;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [settingsOpen]);

  const go = (path: string) => {
    setSettingsOpen(false);
    navigate(path);
  };

  return (
    <header className="border-border-default bg-surface flex h-10 shrink-0 items-center gap-3 border-b px-3">
      <span className="text-ink-900 text-lg font-semibold tracking-tight">
        Visiora<span className="text-accent-500">AI</span>
      </span>
      <span className="text-ink-400 text-sm">Agile</span>

      <GlobalSearchBox />

      <button
        type="button"
        onClick={toggleTheme}
        className="text-ink-500 hover:text-ink-900 hover:bg-surface-sunken rounded p-1 transition-colors"
        aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
        title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      >
        {isDark ? (
          <Sun className="size-4 text-amber-400" strokeWidth={1.75} />
        ) : (
          <Moon className="size-4" strokeWidth={1.75} />
        )}
      </button>

      <div ref={notificationsRef} className="relative">
        <button
          type="button"
          className="text-ink-500 hover:bg-surface-sunken relative rounded p-1"
          aria-label="Notifications"
          onClick={() => setNotificationsOpen((open) => !open)}
        >
          <Bell className="size-4" strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="bg-danger absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full text-[9px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>

        {notificationsOpen && (
          <div className="border-border-default bg-surface absolute right-0 top-full z-40 mt-1 w-80 rounded border shadow-lg">
            <div className="border-border-subtle border-b px-3 py-2">
              <p className="text-ink-900 text-base font-semibold">Notifications</p>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {(notifications ?? []).length === 0 ? (
                <p className="text-ink-400 px-3 py-3 text-sm">Aucune notification.</p>
              ) : (
                notifications?.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => {
                      if (!notification.isRead) markRead.mutate(notification.id);
                      setNotificationsOpen(false);
                      if (
                        notification.entityType === EntityType.PULL_REQUEST &&
                        notification.entityId
                      ) {
                        const targetKey = projectKey ?? 'VIS';
                        navigate(`/projects/${targetKey}/repos?pr=${notification.entityId}`);
                      }
                    }}
                    className="border-border-subtle hover:bg-surface-sunken flex w-full flex-col border-b px-3 py-2 text-left last:border-b-0"
                  >
                    <span className="text-ink-900 text-sm font-semibold">{notification.title}</span>
                    {notification.body && (
                      <span className="text-ink-500 line-clamp-2 text-sm">{notification.body}</span>
                    )}
                    {!notification.isRead && (
                      <span className="text-accent-700 mt-1 text-xs font-semibold">Non lue</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div ref={settingsRef} className="relative">
        <button
          type="button"
          className="text-ink-500 hover:bg-surface-sunken rounded p-1"
          aria-label="Parametres"
          aria-expanded={settingsOpen}
          aria-haspopup="menu"
          title="Parametres"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <Settings className="size-4" strokeWidth={1.75} />
        </button>

        {settingsOpen && (
          <div
            role="menu"
            className="border-border-default bg-surface absolute right-0 top-full z-40 mt-1 w-72 rounded border shadow-lg"
          >
            <div className="border-border-subtle border-b px-3 py-2">
              <p className="text-ink-900 text-base font-semibold">Parametres</p>
              <p className="text-ink-400 text-sm">Compte, portail et administration</p>
            </div>

            <div className="py-1">
              <SettingsMenuItem
                icon={UserCog}
                label="Parametres utilisateur"
                description="Profil, preferences et notifications"
                onClick={() => go('/settings')}
              />
              <SettingsMenuItem
                icon={LayoutDashboard}
                label="Portefeuille"
                description="Tous les projets accessibles"
                onClick={() => go('/portfolio')}
              />
              <SettingsMenuItem
                icon={FolderKanban}
                label="Projet courant"
                description="Vue d'ensemble et membres"
                onClick={() => go(projectKey ? `/projects/${projectKey}/overview` : '/portfolio')}
              />
            </div>

            {isAdmin && (
              <div className="border-border-subtle border-t py-1">
                <p className="text-ink-400 px-3 py-1 text-xs font-semibold uppercase">
                  Administration
                </p>
                <SettingsMenuItem
                  icon={Users}
                  label="Utilisateurs"
                  description="Creer comptes, roles et mots de passe"
                  onClick={() => go('/admin/users')}
                />
                <SettingsMenuItem
                  icon={Shield}
                  label="Securite"
                  description="Roles, sessions et acces"
                  onClick={() => go('/settings?tab=security')}
                />
              </div>
            )}

            {API_DOCS_URL && (
              <div className="border-border-subtle border-t py-1">
                <SettingsMenuItem
                  icon={BookOpen}
                  label="Documentation API"
                  description="Swagger"
                  onClick={() => {
                    setSettingsOpen(false);
                    window.open(API_DOCS_URL, '_blank', 'noopener,noreferrer');
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Compte de ${user?.name ?? ''}`}
        >
          <Avatar name={user?.name ?? '?'} avatarUrl={user?.avatarUrl} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="border-border-default bg-surface absolute right-0 top-full z-40 mt-1 w-56 rounded border shadow-lg"
          >
            <div className="border-border-subtle border-b px-3 py-2">
              <p className="text-ink-900 truncate text-base font-semibold">{user?.name}</p>
              <p className="text-ink-400 truncate text-sm">{user?.email}</p>
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                void logout();
              }}
              className="text-ink-700 hover:bg-surface-sunken flex w-full items-center gap-2 px-3 py-1.5 text-left text-base"
            >
              <LogOut className="size-3.5" strokeWidth={1.75} />
              Se deconnecter
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function SettingsMenuItem({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="hover:bg-surface-sunken flex w-full items-start gap-2 px-3 py-2 text-left"
    >
      <Icon className="text-ink-500 mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <span className="min-w-0">
        <span className="text-ink-900 block text-sm font-semibold">{label}</span>
        <span className="text-ink-400 block text-xs">{description}</span>
      </span>
    </button>
  );
}
