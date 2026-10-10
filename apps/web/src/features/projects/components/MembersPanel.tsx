import { useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { LABELS_FR, ProjectRole } from '@visiora/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Avatar } from '@/components/common/Avatar';
import {
  EmptyState,
  ErrorState,
  InlineError,
  LoadingState,
} from '@/components/common/StateMessage';
import { useProjectMembers, useRemoveMember, useUpdateMember } from '../hooks';
import { AddMemberDialog } from './AddMemberDialog';

interface MembersPanelProps {
  projectRef: string;
  /** Résultat de `can('project:member:manage')` — calculé par le serveur. */
  canManage: boolean;
}

/** B.1 · Affectation des utilisateurs + A.2 · Rôle par projet. */
export function MembersPanel({ projectRef, canManage }: MembersPanelProps) {
  const { data: members, isLoading, error } = useProjectMembers(projectRef);
  const updateMember = useUpdateMember(projectRef);
  const removeMember = useRemoveMember(projectRef);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  const changeRole = async (userId: string, role: ProjectRole) => {
    setActionError(null);
    try {
      await updateMember.mutateAsync({ userId, input: { role } });
    } catch (mutationError) {
      setActionError(mutationError);
    }
  };

  const remove = async (userId: string, name: string) => {
    if (!window.confirm(`Retirer ${name} du projet ?`)) return;
    setActionError(null);
    try {
      await removeMember.mutateAsync(userId);
    } catch (mutationError) {
      setActionError(mutationError);
    }
  };

  return (
    <section className="card overflow-hidden">
      <header className="border-border-subtle flex items-center gap-2 border-b px-4 py-3">
        <h2 className="text-ink-900 text-lg font-semibold">Membres</h2>
        {members && <span className="count-pill">{members.length}</span>}
        {canManage && (
          <Button size="sm" className="ml-auto" onClick={() => setDialogOpen(true)}>
            <UserPlus strokeWidth={1.75} />
            Affecter
          </Button>
        )}
      </header>

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {actionError ? (
        <div className="px-3 pt-2">
          <InlineError error={actionError} />
        </div>
      ) : null}

      {members && members.length === 0 && <EmptyState title="Aucun membre affecté" />}

      {members && members.length > 0 && (
        <ul className="divide-border-subtle divide-y">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={member.user.name} avatarUrl={member.user.avatarUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-ink-900 truncate text-base font-semibold">
                  {member.user.name}
                  {!member.user.isActive && (
                    <Badge tone="danger" className="ml-2">
                      désactivé
                    </Badge>
                  )}
                </p>
                <p className="text-ink-500 truncate text-sm">{member.user.email}</p>
              </div>

              {canManage ? (
                <Select
                  aria-label={`Rôle de ${member.user.name}`}
                  value={member.role}
                  disabled={updateMember.isPending}
                  onChange={(event) =>
                    changeRole(member.user.id, event.target.value as ProjectRole)
                  }
                  className="w-32 shrink-0"
                >
                  {Object.values(ProjectRole).map((role) => (
                    <option key={role} value={role}>
                      {LABELS_FR.projectRole[role]}
                    </option>
                  ))}
                </Select>
              ) : (
                <span className="text-ink-500 text-sm">{LABELS_FR.projectRole[member.role]}</span>
              )}

              {canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Retirer ${member.user.name}`}
                  disabled={removeMember.isPending}
                  onClick={() => remove(member.user.id, member.user.name)}
                  className="text-danger hover:bg-red-50 dark:hover:bg-red-950/40 w-7 px-0"
                >
                  <Trash2 strokeWidth={1.75} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {members && (
        <AddMemberDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          projectRef={projectRef}
          currentMembers={members}
        />
      )}
    </section>
  );
}
