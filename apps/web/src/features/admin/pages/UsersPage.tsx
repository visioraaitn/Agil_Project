import { useMemo, useState } from 'react';
import { KeyRound, ListFilter, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { GlobalRole, LABELS_FR, type UserSummary } from '@visiora/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/common/Avatar';
import { PageHeader } from '@/components/common/PageHeader';
import {
  EmptyState,
  ErrorState,
  InlineError,
  LoadingState,
} from '@/components/common/StateMessage';
import { useAuth } from '@/features/auth/use-auth';
import { cn } from '@/lib/utils';
import { ResetPasswordDialog } from '../components/ResetPasswordDialog';
import { UserFormDialog } from '../components/UserFormDialog';
import { useDeleteUser, useUsers } from '../hooks';

function formatDate(iso: string | null): string {
  if (!iso) return 'jamais';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const SORT_FIELDS = [
  ['name', 'Nom'],
  ['jobTitle', 'Fonction'],
  ['globalRole', 'Rôle'],
  ['isActive', 'Statut'],
  ['lastLoginAt', 'Connexion'],
] as const;

/** A.1 · Gestion des utilisateurs + A.2 · Attribution du rôle plateforme. */
export function UsersPage() {
  const { user: currentUser, canManageAdmins } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<GlobalRole | ''>('');
  const [activeFilter, setActiveFilter] = useState<'true' | 'false' | ''>('');
  const [sortBy, setSortBy] = useState<
    'name' | 'jobTitle' | 'globalRole' | 'isActive' | 'lastLoginAt'
  >('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editing, setEditing] = useState<UserSummary | null>(null);
  const [resetting, setResetting] = useState<UserSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const { data, isLoading, error } = useUsers({
    search: search.trim() || undefined,
    globalRole: roleFilter || undefined,
    isActive: activeFilter ? activeFilter === 'true' : undefined,
    pageSize: 100,
  });
  const deleteUser = useDeleteUser();

  const sortedUsers = useMemo(() => {
    const items = [...(data?.items ?? [])];
    const direction = sortOrder === 'asc' ? 1 : -1;
    return items.sort((left, right) => {
      const leftValue = left[sortBy] ?? '';
      const rightValue = right[sortBy] ?? '';
      return (
        String(leftValue).localeCompare(String(rightValue), 'fr', { numeric: true }) * direction
      );
    });
  }, [data?.items, sortBy, sortOrder]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (user: UserSummary) => {
    setEditing(user);
    setDialogOpen(true);
  };

  const remove = async (user: UserSummary) => {
    if (!window.confirm(`Supprimer le compte de ${user.name} ? Son historique est conservé.`))
      return;
    setActionError(null);
    try {
      await deleteUser.mutateAsync(user.id);
    } catch (mutationError) {
      setActionError(mutationError);
    }
  };

  const reset = (user: UserSummary) => {
    setActionError(null);
    setActionMessage(null);
    setResetting(user);
  };

  const sortValue = `${sortBy}:${sortOrder}`;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 px-4 pt-5 pb-4 sm:px-6">
        <PageHeader
          title="Utilisateurs"
          breadcrumbs={[{ label: 'Administration' }, { label: 'Utilisateurs' }]}
          count={data ? `${data.total} compte${data.total > 1 ? 's' : ''}` : undefined}
          actions={
            <Button variant="primary" onClick={openCreate}>
              <Plus strokeWidth={2.5} />
              Nouveau compte
            </Button>
          }
        />

        <div className="card flex flex-wrap items-center gap-2 p-2.5">
          <div className="relative w-full sm:w-64">
            <Search
              className="text-ink-400 pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              strokeWidth={2}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nom ou email…"
              aria-label="Rechercher un compte"
              className="search-field"
            />
          </div>
          <span className="bg-border-default mx-0.5 hidden h-6 w-px sm:block" aria-hidden="true" />
          <select
            aria-label="Filtrer par rôle plateforme"
            className={cn('filter-select', roleFilter && 'is-active')}
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as GlobalRole | '')}
          >
            <option value="">Tous les rôles</option>
            <option value={GlobalRole.ADMIN}>Administrateurs</option>
            <option value={GlobalRole.MEMBER}>Membres</option>
          </select>
          <select
            aria-label="Filtrer par statut"
            className={cn('filter-select', activeFilter && 'is-active')}
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value as typeof activeFilter)}
          >
            <option value="">Tous statuts</option>
            <option value="true">Actifs</option>
            <option value="false">Désactivés</option>
          </select>

          <div className="relative ml-auto">
            <ListFilter
              className="text-ink-500 pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              strokeWidth={2}
            />
            <select
              aria-label="Trier les utilisateurs"
              value={sortValue}
              onChange={(event) => {
                const [field, order] = event.target.value.split(':') as [
                  typeof sortBy,
                  typeof sortOrder,
                ];
                setSortBy(field);
                setSortOrder(order);
              }}
              className="bg-surface-sunken text-ink-700 hover:bg-border-subtle focus:border-accent-500 h-8 cursor-pointer appearance-none rounded-lg border border-transparent pr-3 pl-7.5 text-sm font-medium focus:outline-none"
            >
              {SORT_FIELDS.flatMap(([field, label]) => [
                <option key={`${field}:asc`} value={`${field}:asc`}>
                  {label} · A → Z
                </option>,
                <option key={`${field}:desc`} value={`${field}:desc`}>
                  {label} · Z → A
                </option>,
              ])}
            </select>
          </div>
        </div>

        <InlineError error={actionError} />
        {actionMessage ? (
          <p className="text-success rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-base dark:border-green-900/60 dark:bg-green-950/40">
            {actionMessage}
          </p>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-6 sm:px-6">
        <div className="card scrollbar-thin max-h-full min-h-0 overflow-auto">
          {isLoading && <LoadingState />}
          {error && <ErrorState error={error} />}
          {data && data.items.length === 0 && <EmptyState title="Aucun compte trouvé" />}

          {data && data.items.length > 0 && (
            <table className="w-full min-w-[860px] border-collapse text-base">
              <thead className="bg-surface-muted text-ink-500 sticky top-0 z-10 text-left text-[11px] tracking-wider uppercase">
                <tr className="border-border-default border-b">
                  <th className="px-5 py-3 font-semibold">Utilisateur</th>
                  <th className="px-3 py-3 font-semibold">Fonction</th>
                  <th className="px-3 py-3 font-semibold">Rôle plateforme</th>
                  <th className="px-3 py-3 font-semibold">Statut</th>
                  <th className="px-3 py-3 font-semibold">Dernière connexion</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => {
                  const adminLocked = user.globalRole === GlobalRole.ADMIN && !canManageAdmins;
                  const isMe = user.id === currentUser?.id;
                  return (
                    <tr
                      key={user.id}
                      className={cn(
                        'border-border-subtle hover:bg-surface-muted border-b last:border-b-0',
                        isMe && 'bg-accent-50/40',
                      )}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={user.name} avatarUrl={user.avatarUrl} size="lg" />
                          <div className="min-w-0">
                            <p className="text-ink-900 truncate font-semibold">
                              {user.name}
                              {isMe && (
                                <span className="text-ink-500 ml-1 font-normal">(vous)</span>
                              )}
                            </p>
                            <p className="text-ink-500 truncate text-sm">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-ink-700 px-3 py-3">
                        {user.jobTitle ? LABELS_FR.userFunction[user.jobTitle] : '—'}
                      </td>
                      <td className="px-3 py-3">
                        {user.globalRole === GlobalRole.ADMIN ? (
                          <div className="flex flex-col items-start gap-1">
                            <Badge tone="accent">Administrateur</Badge>
                            {user.isSuperAdmin && (
                              <Badge tone="success">Super administrateur</Badge>
                            )}
                          </div>
                        ) : (
                          <Badge>Membre</Badge>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {user.isActive ? (
                          <Badge tone="success" dot>
                            Actif
                          </Badge>
                        ) : (
                          <Badge tone="danger" dot>
                            Désactivé
                          </Badge>
                        )}
                      </td>
                      <td className="text-ink-700 px-3 py-3">{formatDate(user.lastLoginAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-8 px-0"
                            aria-label={`Modifier ${user.name}`}
                            title="Modifier"
                            disabled={adminLocked}
                            onClick={() => openEdit(user)}
                          >
                            <Pencil strokeWidth={1.75} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-8 px-0"
                            aria-label={`Réinitialiser le mot de passe de ${user.name}`}
                            title="Réinitialiser le mot de passe"
                            disabled={adminLocked}
                            onClick={() => reset(user)}
                          >
                            <KeyRound strokeWidth={1.75} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger w-8 px-0 hover:bg-red-50 dark:hover:bg-red-950/40"
                            aria-label={`Supprimer ${user.name}`}
                            title="Supprimer"
                            disabled={isMe || adminLocked}
                            onClick={() => remove(user)}
                          >
                            <Trash2 strokeWidth={1.75} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <UserFormDialog open={dialogOpen} onClose={() => setDialogOpen(false)} user={editing} />
      <ResetPasswordDialog
        user={resetting}
        onClose={() => setResetting(null)}
        onSuccess={(user) =>
          setActionMessage(
            `Mot de passe de ${user.name} réinitialisé. Toutes ses sessions ont été fermées.`,
          )
        }
      />
    </div>
  );
}
