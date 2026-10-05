import { AlertTriangle } from 'lucide-react';
import type { SprintPropagationConflict } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { TypeIcon } from './WorkItemChrome';

interface SprintConflictDialogProps {
  open: boolean;
  conflicts: SprintPropagationConflict[];
  targetSprintName: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}

/**
 * C.1 · Confirmation explicite avant de déplacer un Epic dont des descendants
 * sont déjà affectés à un autre sprint. Le backend reste seul juge de ce qui
 * constitue un conflit — ce dialog affiche sa réponse, ne décide de rien.
 */
export function SprintConflictDialog({
  open,
  conflicts,
  targetSprintName,
  onCancel,
  onConfirm,
  confirming,
}: SprintConflictDialogProps) {
  if (!open) return null;

  return (
    <Modal
      open={open}
      title="Changer le sprint de l'Epic ?"
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Annuler</Button>
          <Button variant="primary" onClick={onConfirm} loading={confirming}>
            Confirmer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="bg-orange-50 text-warning flex items-start gap-2 rounded px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          <span>
            Certains éléments de cet Epic sont déjà affectés à un autre Sprint. En confirmant,
            l'Epic et toute sa hiérarchie passeront dans <strong>{targetSprintName}</strong>.
          </span>
        </div>

        <div className="border-border-default scrollbar-thin max-h-60 overflow-y-auto rounded border">
          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className="border-border-subtle flex items-center gap-2 border-b px-3 py-1.5 text-sm last:border-b-0"
            >
              <TypeIcon type={conflict.type} />
              <span className="text-ink-400 shrink-0 text-xs font-semibold">{conflict.key}</span>
              <span className="text-ink-900 min-w-0 flex-1 truncate">{conflict.title}</span>
              <span className="text-ink-400 shrink-0 text-xs">{conflict.currentSprintName}</span>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
