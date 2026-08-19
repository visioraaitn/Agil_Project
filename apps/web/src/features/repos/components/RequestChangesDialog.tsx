import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Textarea } from '@/components/ui/input';
import { InlineError } from '@/components/common/StateMessage';

export function RequestChangesDialog({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => Promise<void>;
  loading: boolean;
}) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!comment.trim()) {
      setError('Veuillez préciser les modifications attendues avant de soumettre.');
      return;
    }
    setError(null);
    await onSubmit(comment.trim());
    setComment('');
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Demander des modifications"
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button
            variant="secondary"
            className="border-amber-400 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            onClick={handleSubmit}
            loading={loading}
          >
            Demander les modifications
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-ink-600 text-sm">
          Indiquez à l’auteur les points de code ou spécifications à rectifier. L’auteur recevra
          une notification instantanée et pourra soumettre une nouvelle version pour révision.
        </p>

        {error && <InlineError error={new Error(error)} />}

        <Field label="Modifications requises *" htmlFor="changes-reason" required>
          <Textarea
            id="changes-reason"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Ex : - Corriger la gestion de concurrence sur le token refresh&#10;- Ajouter les tests unitaires sur les cas d’erreur 401&#10;- Respecter le format de retour API..."
          />
        </Field>
      </div>
    </Modal>
  );
}
