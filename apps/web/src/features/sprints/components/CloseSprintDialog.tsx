import { useEffect, useMemo, useState } from 'react';
import { SprintStatus, WorkItemStatus, type SprintDetail } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/common/StateMessage';
import { StatusPill } from '@/features/work-items/components/WorkItemChrome';
import { useCloseSprint, useSprints } from '../hooks';

interface CloseSprintDialogProps {
  open: boolean;
  onClose: () => void;
  projectRef: string;
  sprint: SprintDetail;
}

/**
 * C.3 · Clôture de sprint. Un sprint sans élément non terminé se ferme en un
 * clic ; s'il en reste, un sprint de destination doit être choisi
 * explicitement — jamais un déplacement arbitraire (cf. cahier des charges).
 */
export function CloseSprintDialog({ open, onClose, projectRef, sprint }: CloseSprintDialogProps) {
  const closeSprint = useCloseSprint(projectRef);
  const { data: sprints } = useSprints(projectRef);
  const [retroSummary, setRetroSummary] = useState('');
  const [targetSprintId, setTargetSprintId] = useState('');

  const unfinishedItems = useMemo(
    () => sprint.items.filter((item) => item.status !== WorkItemStatus.DONE),
    [sprint.items],
  );
  const targetOptions = useMemo(
    () =>
      (sprints ?? []).filter(
        (candidate) => candidate.id !== sprint.id && candidate.status !== SprintStatus.COMPLETED,
      ),
    [sprints, sprint.id],
  );

  useEffect(() => {
    if (!open) return;
    setRetroSummary(sprint.retroSummary ?? '');
    setTargetSprintId('');
  }, [open, sprint.retroSummary]);

  const requiresTarget = unfinishedItems.length > 0;
  const invalid = requiresTarget && !targetSprintId;

  const submit = async () => {
    await closeSprint.mutateAsync({
      sprintId: sprint.id,
      input: {
        retroSummary: retroSummary || null,
        targetSprintId: requiresTarget ? targetSprintId : undefined,
      },
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      title={`Clôturer ${sprint.name} ?`}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={closeSprint.isPending}
            disabled={invalid}
          >
            Clôturer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <InlineError error={closeSprint.error} />

        {unfinishedItems.length === 0 ? (
          <p className="text-ink-600 text-sm">
            Aucun élément non terminé dans ce sprint : il sera clôturé tel quel.
          </p>
        ) : (
          <>
            <p className="text-ink-700 text-sm">
              {unfinishedItems.length} élément(s) non terminé(s) — ils seront déplacés vers le
              sprint choisi ci-dessous, sans changer leur hiérarchie Epic / User Story / Sous-tâche.
              Les éléments terminés restent dans {sprint.name}.
            </p>

            <div className="border-border-default scrollbar-thin max-h-40 overflow-y-auto rounded border">
              {unfinishedItems.map((item) => (
                <div
                  key={item.id}
                  className="border-border-subtle flex items-center gap-2 border-b px-3 py-1.5 last:border-b-0"
                >
                  <span className="text-ink-400 w-20 shrink-0 text-xs font-semibold">
                    {item.key}
                  </span>
                  <span className="text-ink-900 min-w-0 flex-1 truncate text-sm">{item.title}</span>
                  <StatusPill status={item.status} />
                </div>
              ))}
            </div>

            <Field label="Déplacer les éléments non terminés vers" htmlFor="close-target-sprint" required>
              <Select
                id="close-target-sprint"
                value={targetSprintId}
                onChange={(event) => setTargetSprintId(event.target.value)}
              >
                <option value="">Choisir un sprint…</option>
                {targetOptions.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </Select>
            </Field>

            {targetOptions.length === 0 && (
              <p className="text-danger text-xs">
                Aucun sprint valide disponible : créez d'abord un sprint de destination.
              </p>
            )}
          </>
        )}

        <Field label="Synthèse de la rétrospective (optionnel)" htmlFor="close-retro">
          <Textarea
            id="close-retro"
            value={retroSummary}
            onChange={(event) => setRetroSummary(event.target.value)}
            rows={3}
          />
        </Field>
      </div>
    </Modal>
  );
}
