import { useState } from 'react';
import { KeyRound, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { GlobalRole, type UserSummary } from '@visiora/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState, ErrorState, InlineError, LoadingState } from '@/components/common/StateMessage';
import { useAuth } from '@/features/auth/use-auth';
import { UserFormDialog } from '../components/UserFormDialog';
import { useDeleteUser, useResetPassword, useUsers } from '../hooks';

function formatDate(iso: string | null): string {
  if (!iso) return 'jamais';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** A.1 · Gestion des utilisateurs + A.2 · Attribution du rôle plateforme. */
export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  const { data, isLoading, error } = useUsers({ search: search.trim() || undefined, pageSize: 100 });
  const deleteUser = useDeleteUser();
  const resetPassword = useResetPassword();

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (user: UserSummary) => {
    setEditing(user);
    setDialogOpen(true);
  };

  const remove = async (user: UserSummary) => {
    if (!window.confirm(`Supprimer le compte de ${user.name} ? Son historique est conservé.`)) return;
    setActionError(null);
    try {
      await deleteUser.mutateAsync(user.id);
    } catch (mutationError) {
      setActionError(mutationError);
    }
  };

  const reset = async (user: UserSummary) => {
    const newPassword = window.prompt(
      `Nouveau mot de passe pour ${user.name} (10 caractères minimum, majuscule, minuscule et chiffre) :`,
    );
    if (!newPassword) return;
    setActionError(null);
    try {
      await resetPassword.mutateAsync({ userId: user.id, newPassword });
      window.alert('Mot de passe réinitialisé. Toutes ses sessions ont été fermées.');
    } catch (mutationError) {
      setActionError(mutationError);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <header className="border-border-subtle flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <h1 className="text-ink-900 text-xl font-semibold">Utilisateurs</h1>
        {data && <span className="text-ink-400 text-sm">{data.total} compte(s)</span>}

        <div className="ml-auto flex items-center gap-2">
          <div className="border-border-strong bg-surface focus-within:border-accent-500 flex h-7 w-56 items-center gap-1.5 rounded border px-2">
            <Search className="text-ink-400 size-3.5 shrink-0" strokeWidth={2} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom ou email…"
              aria-label="Rechercher un compte"
              className="text-ink-700 placeholder:text-ink-400 w-full bg-transparent text-base outline-none"
            />
          </div>
          <Button variant="primary" onClick={openCreate}>
            <Plus className="size-3.5" strokeWidth={2.5} />
            Nouveau compte
          </Button>
        </div>
      </header>

      {actionError ? (
        <div className="px-4 pt-2">
          <InlineError error={actionError} />
        </div>
      ) : null}

      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
        {isLoading && <LoadingState />}
        {error && <ErrorState error={error} />}
        {data && data.items.length === 0 && <EmptyState title="Aucun compte trouvé" />}

        {data && data.items.length > 0 && (
          <table className="w-full border-collapse text-base">
            <thead className="bg-surface-muted text-ink-500 sticky top-0 text-left text-sm">
              <tr className="border-border-default border-b">
                <th className="px-4 py-1.5 font-semibold">Utilisateur</th>
                <th className="px-3 py-1.5 font-semibold">Fonction</th>
                <th className="px-3 py-1.5 font-semibold">Rôle plateforme</th>
                <th className="px-3 py-1.5 font-semibold">Statut</th>
                <th className="px-3 py-1.5 font-semibold">Dernière connexion</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <tr key={user.id} className="border-border-subtle hover:bg-surface-muted border-b">
                  <td className="px-4 py-1.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={user.name} avatarUrl={user.avatarUrl} />
                      <div className="min-w-0">
                        <p className="text-ink-900 truncate font-semibold">
                          {user.name}
                          {user.id === currentUser?.id && (
                            <span className="text-ink-400 ml-1 font-normal">(vous)</span>
                          )}
                        </p>
                        <p className="text-ink-400 truncate text-sm">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-ink-500 px-3 py-1.5">{user.jobTitle ?? '—'}</td>
                  <td className="px-3 py-1.5">
                    {user.globalRole === GlobalRole.ADMIN ? (
                      <Badge tone="accent">Administrateur</Badge>
                    ) : (
                      <Badge>Membre</Badge>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {user.isActive ? (
                      <Badge tone="success">Actif</Badge>
                    ) : (
                      <Badge tone="danger">Désactivé</Badge>
                    )}
                  </td>
                  <td className="text-ink-500 px-3 py-1.5">{formatDate(user.lastLoginAt)}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Modifier ${user.name}`}
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="size-3.5" strokeWidth={1.75} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Réinitialiser le mot de passe de ${user.name}`}
                        onClick={() => reset(user)}
                      >
                        <KeyRound className="size-3.5" strokeWidth={1.75} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Supprimer ${user.name}`}
                        disabled={user.id === currentUser?.id}
                        onClick={() => remove(user)}
                      >
                        <Trash2 className="text-danger size-3.5" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <UserFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} user={editing} />
    </div>
  );
}
