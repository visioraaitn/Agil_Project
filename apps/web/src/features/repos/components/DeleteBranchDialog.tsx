import { AlertTriangle } from 'lucide-react';
import type { BranchSummary } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

export function DeleteBranchDialog({
  open,
  branch,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  branch: BranchSummary | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  loading: boolean;
}) {
  if (!branch) return null;

  return (
    <Modal
      open={open}
      title="Supprimer la branche"
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Supprimer la branche
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 flex items-start gap-2.5 rounded border p-3">
          <AlertTriangle className="text-danger mt-0.5 size-5 shrink-0" strokeWidth={2} />
          <div className="text-sm">
            <p className="text-danger font-semibold">Êtes-vous sûr ?</p>
            <p className="text-ink-700 dark:text-ink-300 text-xs">
              Vous allez supprimer définitivement la référence de branche{' '}
              <span className="font-mono font-bold text-ink-900 dark:text-ink-100">{branch.name}</span>.
              Cette action ne peut pas être annulée.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
