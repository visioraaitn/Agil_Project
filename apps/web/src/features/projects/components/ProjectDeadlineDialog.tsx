import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/common/StateMessage';
import { useUpdateProject } from '../hooks';

interface ProjectDeadlineDialogProps {
  projectRef: string;
  currentTargetDate: string | null;
  open: boolean;
  onClose: () => void;
}

export function ProjectDeadlineDialog({
  projectRef,
  currentTargetDate,
  open,
  onClose,
}: ProjectDeadlineDialogProps) {
  const update = useUpdateProject(projectRef);
  const [targetDate, setTargetDate] = useState('');
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setTargetDate(currentTargetDate?.slice(0, 10) ?? '');
      setError(null);
    }
  }, [currentTargetDate, open]);

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        targetDate: targetDate ? new Date(`${targetDate}T00:00:00.000Z`) : null,
      });
      onClose();
    } catch (updateError) {
      setError(updateError);
    }
  };

  return (
    <Modal
      open={open}
      title="Modifier l’échéance"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={update.isPending} onClick={() => void save()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field
          label="Date d’échéance"
          htmlFor="project-target-date"
          hint="Laissez vide pour retirer l’échéance."
        >
          <Input
            id="project-target-date"
            type="date"
            value={targetDate}
            onChange={(event) => setTargetDate(event.target.value)}
          />
        </Field>
        <InlineError error={error} />
      </div>
    </Modal>
  );
}
