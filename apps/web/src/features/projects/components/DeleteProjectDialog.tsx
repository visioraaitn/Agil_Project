import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { InlineError } from '@/components/common/StateMessage';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useDeleteProject } from '../hooks';

interface DeleteProjectDialogProps {
  projectRef: string;
  projectName: string;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteProjectDialog({
  projectRef,
  projectName,
  open,
  onClose,
  onDeleted,
}: DeleteProjectDialogProps) {
  const remove = useDeleteProject(projectRef);
  const [confirmationName, setConfirmationName] = useState('');
  const [error, setError] = useState<unknown>(null);
  const confirmed = confirmationName === projectName;

  useEffect(() => {
    if (!open) return;
    setConfirmationName('');
    setError(null);
  }, [open]);

  const confirm = async () => {
    if (!confirmed) return;
    setError(null);
    try {
      await remove.mutateAsync({ confirmationName });
      onDeleted();
    } catch (deleteError) {
      setError(deleteError);
    }
  };

  return (
    <Modal
      open={open}
      title="Supprimer définitivement le projet"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="danger"
            disabled={!confirmed}
            loading={remove.isPending}
            onClick={() => void confirm()}
          >
            Supprimer définitivement
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="border-danger/30 bg-danger/5 text-ink-700 flex gap-2 rounded border p-3 text-sm">
          <AlertTriangle className="text-danger mt-0.5 size-4 shrink-0" />
          <p>
            Cette action supprime le projet, ses tickets, documents, pièces jointes et tout son
            historique. Elle est irréversible.
          </p>
        </div>
        <Field
          label={`Saisissez exactement « ${projectName} » pour confirmer`}
          htmlFor="delete-project-confirmation"
          required
        >
          <Input
            id="delete-project-confirmation"
            autoFocus
            autoComplete="off"
            value={confirmationName}
            invalid={confirmationName.length > 0 && !confirmed}
            onChange={(event) => setConfirmationName(event.target.value)}
          />
        </Field>
        <InlineError error={error} />
      </div>
    </Modal>
  );
}
