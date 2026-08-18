import { useMemo, useState } from 'react';
import { LABELS_FR, ProjectRole, type ProjectMemberSummary } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/common/StateMessage';
import { useUserDirectory } from '@/features/admin/hooks';
import { useAddMember } from '../hooks';

interface AddMemberDialogProps {
  open: boolean;
  onClose: () => void;
  projectRef: string;
  currentMembers: ProjectMemberSummary[];
}

export function AddMemberDialog({ open, onClose, projectRef, currentMembers }: AddMemberDialogProps) {
  const addMember = useAddMember(projectRef);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<ProjectRole>(ProjectRole.DEVELOPER);
  const [submitError, setSubmitError] = useState<unknown>(null);

  // Annuaire, et non la liste d'administration : un PO n'a pas `user:manage`.
  const { data, error: usersError } = useUserDirectory(undefined, open);

  const candidates = useMemo(() => {
    const memberIds = new Set(currentMembers.map((member) => member.user.id));
    return (data ?? []).filter((user) => !memberIds.has(user.id));
  }, [data, currentMembers]);

  const close = () => {
    setUserId('');
    setRole(ProjectRole.DEVELOPER);
    setSubmitError(null);
    onClose();
  };

  const submit = async () => {
    setSubmitError(null);
    try {
      await addMember.mutateAsync({ userId, role });
      close();
    } catch (error) {
      setSubmitError(error);
    }
  };

  return (
    <Modal
      open={open}
      title="Affecter un membre"
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Annuler</Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={addMember.isPending}
            disabled={!userId}
          >
            Affecter
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {usersError ? (
          <InlineError error={usersError} />
        ) : (
          <Field label="Utilisateur" htmlFor="member-user" required>
            <Select
              id="member-user"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            >
              <option value="">Sélectionner un compte…</option>
              {candidates.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} — {user.email}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field
          label="Rôle sur ce projet"
          htmlFor="member-role"
          hint="Un même utilisateur peut porter un rôle différent sur chaque projet."
          required
        >
          <Select
            id="member-role"
            value={role}
            onChange={(event) => setRole(event.target.value as ProjectRole)}
          >
            {Object.values(ProjectRole).map((value) => (
              <option key={value} value={value}>
                {LABELS_FR.projectRole[value]}
              </option>
            ))}
          </Select>
        </Field>

        {candidates.length === 0 && !usersError && (
          <p className="text-ink-400 text-sm">
            Tous les comptes actifs sont déjà membres de ce projet.
          </p>
        )}

        <InlineError error={submitError} />
      </div>
    </Modal>
  );
}
