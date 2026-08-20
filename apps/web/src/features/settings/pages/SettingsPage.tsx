import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  Bell,
  ImageUp,
  KeyRound,
  LayoutDashboard,
  Palette,
  Shield,
  UserCog,
  Users,
} from 'lucide-react';
import { GlobalRole } from '@visiora/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Avatar } from '@/components/common/Avatar';
import { InlineError } from '@/components/common/StateMessage';
import { useAuth } from '@/features/auth/use-auth';
import { authApi } from '@/features/auth/api';
import { usersApi } from '@/features/admin/api';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface PortalPreferences {
  density: 'compact' | 'comfortable';
  language: 'fr' | 'en';
  notifications: boolean;
}

const STORAGE_KEY = 'visiora.portal.preferences';
const DEFAULT_PREFERENCES: PortalPreferences = {
  density: 'compact',
  language: 'fr',
  notifications: true,
};

export function SettingsPage() {
  const { user, isAdmin, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [preferences, setPreferences] = useState<PortalPreferences>(() => readPreferences());
  const [profile, setProfile] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    jobTitle: '',
  });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [profileError, setProfileError] = useState<unknown>(null);
  const [passwordError, setPasswordError] = useState<unknown>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<unknown>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const activeTab = searchParams.get('tab') === 'security' ? 'security' : 'profile';

  useEffect(() => {
    setProfile({
      name: user?.name ?? '',
      email: user?.email ?? '',
      jobTitle: '',
    });
  }, [user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const roleLabel = useMemo(
    () => (user?.globalRole === GlobalRole.ADMIN ? 'Administrateur' : 'Membre'),
    [user?.globalRole],
  );

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileSaved(false);
    setProfileError(null);
    try {
      await usersApi.updateProfile({
        name: profile.name,
        email: profile.email,
        jobTitle: profile.jobTitle || null,
      });
      await refreshUser();
      setProfileSaved(true);
    } catch (error) {
      setProfileError(error);
    } finally {
      setProfileSaving(false);
    }
  };

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setAvatarError(null);
    try {
      await usersApi.uploadAvatar(file);
      await refreshUser();
    } catch (error) {
      setAvatarError(error);
    } finally {
      setAvatarUploading(false);
      input.value = '';
    }
  };

  const changePassword = async () => {
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      await authApi.changePassword(passwords);
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setPasswordError(error);
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="scrollbar-thin h-full overflow-auto">
      <header className="border-border-subtle flex items-center gap-3 border-b px-4 py-2">
        <SettingsIcon />
        <div>
          <h1 className="text-ink-900 text-xl font-semibold">Parametres</h1>
          <p className="text-ink-400 text-sm">Compte, preferences et securite du portail</p>
        </div>
      </header>

      <div className="grid gap-4 p-4 xl:grid-cols-[280px_1fr]">
        <aside className="border-border-default bg-surface h-fit rounded border py-1">
          <SettingsNavItem
            active={activeTab === 'profile'}
            icon={UserCog}
            label="Compte"
            onClick={() => navigate('/settings')}
          />
          <SettingsNavItem
            active={activeTab === 'security'}
            icon={Shield}
            label="Securite"
            onClick={() => navigate('/settings?tab=security')}
          />
          {isAdmin && (
            <SettingsNavItem
              active={false}
              icon={Users}
              label="Utilisateurs"
              onClick={() => navigate('/admin/users')}
            />
          )}
          <SettingsNavItem
            active={false}
            icon={LayoutDashboard}
            label="Portefeuille"
            onClick={() => navigate('/portfolio')}
          />
        </aside>

        {activeTab === 'profile' ? (
          <main className="flex flex-col gap-4">
            <section className="border-border-default bg-surface rounded border">
              <header className="border-border-subtle flex items-center gap-3 border-b px-3 py-2">
                <Avatar name={user?.name ?? '?'} avatarUrl={user?.avatarUrl} />
                <div className="min-w-0">
                  <h2 className="text-ink-900 truncate text-lg font-semibold">{user?.name}</h2>
                  <p className="text-ink-400 truncate text-sm">{user?.email}</p>
                </div>
                <Badge tone={user?.globalRole === GlobalRole.ADMIN ? 'accent' : 'neutral'}>
                  {roleLabel}
                </Badge>
              </header>
              <dl className="grid gap-3 px-3 py-3 text-base md:grid-cols-2">
                <div>
                  <dt className="text-ink-400 text-sm">Nom</dt>
                  <dd className="text-ink-900">{user?.name}</dd>
                </div>
                <div>
                  <dt className="text-ink-400 text-sm">Email</dt>
                  <dd className="text-ink-900">{user?.email}</dd>
                </div>
                <div>
                  <dt className="text-ink-400 text-sm">Role plateforme</dt>
                  <dd className="text-ink-900">{roleLabel}</dd>
                </div>
              </dl>
            </section>

            <section className="border-border-default bg-surface rounded border">
              <header className="border-border-subtle flex items-center gap-2 border-b px-3 py-2">
                <UserCog className="text-ink-500 size-4" strokeWidth={1.75} />
                <h2 className="text-ink-900 text-lg font-semibold">Modifier mon profil</h2>
              </header>
              <div className="grid gap-3 px-3 py-3 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-ink-700 text-sm font-semibold">Nom complet</span>
                  <Input
                    value={profile.name}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-ink-700 text-sm font-semibold">Adresse email</span>
                  <Input
                    type="email"
                    value={profile.email}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-ink-700 text-sm font-semibold">Fonction</span>
                  <Input
                    value={profile.jobTitle}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, jobTitle: event.target.value }))
                    }
                    placeholder="Ex. Developpeur, Stagiaire, Product Owner"
                  />
                </label>
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-ink-700 flex items-center gap-1 text-sm font-semibold">
                    <ImageUp className="size-4" strokeWidth={1.75} />
                    Photo de profil
                  </span>
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => void uploadAvatar(event)}
                    disabled={avatarUploading}
                  />
                  <span className="text-ink-400 text-xs">JPG, PNG ou WebP, 5 Mo maximum.</span>
                </label>
              </div>
              <div className="border-border-subtle flex items-center gap-3 border-t px-3 py-3">
                <Button variant="primary" onClick={saveProfile} loading={profileSaving}>
                  Enregistrer le profil
                </Button>
                {profileSaved && (
                  <span className="text-success text-sm font-semibold">Profil mis a jour</span>
                )}
                <InlineError error={profileError} />
                {avatarUploading && (
                  <span className="text-ink-400 text-sm">Envoi de l'avatar…</span>
                )}
                <InlineError error={avatarError} />
              </div>
            </section>

            <section className="border-border-default bg-surface rounded border">
              <header className="border-border-subtle flex items-center gap-2 border-b px-3 py-2">
                <Palette className="text-ink-500 size-4" strokeWidth={1.75} />
                <h2 className="text-ink-900 text-lg font-semibold">Preferences portail</h2>
              </header>
              <div className="grid gap-3 px-3 py-3 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-ink-700 text-sm font-semibold">Densite</span>
                  <Select
                    value={preferences.density}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        density: event.target.value as PortalPreferences['density'],
                      }))
                    }
                  >
                    <option value="compact">Compacte</option>
                    <option value="comfortable">Confortable</option>
                  </Select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-ink-700 text-sm font-semibold">Langue</span>
                  <Select
                    value={preferences.language}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        language: event.target.value as PortalPreferences['language'],
                      }))
                    }
                  >
                    <option value="fr">Francais</option>
                    <option value="en">English</option>
                  </Select>
                </label>

                <label className="text-ink-700 flex items-center gap-2 text-base">
                  <input
                    type="checkbox"
                    checked={preferences.notifications}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        notifications: event.target.checked,
                      }))
                    }
                    className="size-3.5"
                  />
                  Notifications in-app
                </label>
              </div>
            </section>
          </main>
        ) : (
          <main className="flex flex-col gap-4">
            <section className="border-border-default bg-surface rounded border">
              <header className="border-border-subtle flex items-center gap-2 border-b px-3 py-2">
                <Shield className="text-ink-500 size-4" strokeWidth={1.75} />
                <h2 className="text-ink-900 text-lg font-semibold">Securite</h2>
              </header>
              <div className="grid gap-3 px-3 py-3 md:grid-cols-2">
                <SettingStatus
                  icon={KeyRound}
                  label="Authentification locale"
                  value="Active"
                  tone="success"
                />
                <SettingStatus
                  icon={Bell}
                  label="Sessions"
                  value="Token JWT + refresh cookie"
                  tone="accent"
                />
              </div>
              {isAdmin && (
                <div className="border-border-subtle flex gap-2 border-t px-3 py-3">
                  <Button variant="primary" onClick={() => navigate('/admin/users')}>
                    <Users className="size-3.5" strokeWidth={1.75} />
                    Gerer les utilisateurs
                  </Button>
                </div>
              )}
            </section>

            <section className="border-border-default bg-surface rounded border">
              <header className="border-border-subtle flex items-center gap-2 border-b px-3 py-2">
                <KeyRound className="text-ink-500 size-4" strokeWidth={1.75} />
                <h2 className="text-ink-900 text-lg font-semibold">Changer mon mot de passe</h2>
              </header>
              <div className="grid gap-3 px-3 py-3 md:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-ink-700 text-sm font-semibold">Mot de passe actuel</span>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={passwords.currentPassword}
                    onChange={(event) =>
                      setPasswords((current) => ({
                        ...current,
                        currentPassword: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-ink-700 text-sm font-semibold">Nouveau mot de passe</span>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={passwords.newPassword}
                    onChange={(event) =>
                      setPasswords((current) => ({ ...current, newPassword: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="border-border-subtle flex items-center gap-3 border-t px-3 py-3">
                <Button variant="primary" onClick={changePassword} loading={passwordSaving}>
                  Changer le mot de passe
                </Button>
                <span className="text-ink-400 text-sm">
                  Vous serez deconnecte apres validation.
                </span>
                <InlineError error={passwordError} />
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

function SettingsIcon() {
  return (
    <span className="bg-accent-50 text-accent-700 flex size-8 items-center justify-center rounded">
      <UserCog className="size-4.5" strokeWidth={1.75} />
    </span>
  );
}

function SettingsNavItem({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof UserCog;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-base ${
        active
          ? 'bg-accent-50 text-accent-700 font-semibold'
          : 'text-ink-700 hover:bg-surface-sunken'
      }`}
    >
      <Icon className="size-4" strokeWidth={1.75} />
      {label}
    </button>
  );
}

function SettingStatus({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof UserCog;
  label: string;
  value: string;
  tone: 'success' | 'accent';
}) {
  return (
    <div className="border-border-subtle rounded border px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon className="text-ink-500 size-4" strokeWidth={1.75} />
        <span className="text-ink-700 text-sm font-semibold">{label}</span>
      </div>
      <p className="mt-1">
        <Badge tone={tone}>{value}</Badge>
      </p>
    </div>
  );
}

function readPreferences(): PortalPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<PortalPreferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}
