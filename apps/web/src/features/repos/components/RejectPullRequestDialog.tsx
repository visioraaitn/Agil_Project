import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/input';
import { InlineError } from '@/components/common/StateMessage';

export function RejectPullRequestDialog({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (rejectionReason: string) => Promise<void>;
  loading: boolean;
}) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!rejectionReason.trim()) {
      setError('Un motif explicatif est obligatoire pour rejeter définitivement cette Pull Request.');
      return;
    }
    setError(null);
    await onSubmit(rejectionReason.trim());
    setRejectionReason('');
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Rejeter définitivement la Pull Request"
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button variant="danger" onClick={handleSubmit} loading={loading}>
            Confirmer le rejet
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 flex items-start gap-2.5 rounded border p-3">
          <AlertTriangle className="text-danger mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <div className="text-sm">
            <p className="text-danger font-semibold">Action définitive</p>
            <p className="text-ink-700 dark:text-ink-300 text-xs">
              Le rejet clôturera définitivement cette proposition. Le motif saisi sera conservé
              dans l’historique d’audit de la PR et notifié à l’auteur.
            </p>
          </div>
        </div>

        {error && <InlineError error={new Error(error)} />}

        <Field label="Motif explicatif du rejet *" htmlFor="rejection-reason" required>
          <Textarea
            id="rejection-reason"
            rows={4}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Ex : L'approche retenue est incompatible avec l'architecture définie. Une refonte complète de la stratégie de cache est requise avant toute nouvelle proposition."
          />
        </Field>
      </div>
    </Modal>
  );
}
