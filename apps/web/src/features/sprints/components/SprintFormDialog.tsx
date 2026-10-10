import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { sprintPeriodsOverlap, type SprintSummary } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/common/StateMessage';
import { formatSprintDate } from '../format';
import { useCreateSprint, useSprints, useUpdateSprint } from '../hooks';

/** Jour calendaire « AAAA-MM-JJ » (UTC), la référence de l'API pour les dates de sprint. */
const toDay = (value: Date | string) => new Date(value).toISOString().slice(0, 10);
const addDays = (day: string, days: number) =>
  toDay(new Date(new Date(`${day}T00:00:00Z`).getTime() + days * 24 * 60 * 60 * 1000));

/** Durée par défaut d'un nouveau sprint : deux semaines. */
const DEFAULT_LENGTH_DAYS = 13;

interface SprintFormDialogProps {
  projectRef: string;
  open: boolean;
  onClose: () => void;
  /** Sprint à modifier ; absent pour une création. */
  sprint?: SprintSummary | null;
  onSaved?: (sprintId: string) => void;
}

/**
 * C.3 · Création et modification d'un sprint, dans un même formulaire.
 *
 * Les règles de dates sont celles de l'API (qui reste seule juge) : début à
 * partir d'aujourd'hui et aucun jour partagé avec un autre sprint. Le
 * formulaire les signale avant l'envoi. En modification, seules les dates
 * changées sont contrôlées : un sprint actif commencé hier garde son début.
 */
export function SprintFormDialog({
  projectRef,
  open,
  onClose,
  sprint,
  onSaved,
}: SprintFormDialogProps) {
  const isEdit = Boolean(sprint);
  const { data: sprints } = useSprints(projectRef);
  const createSprint = useCreateSprint(projectRef);
  const updateSprint = useUpdateSprint(projectRef);
  const mutation = isEdit ? updateSprint : createSprint;

  const today = toDay(new Date());
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  // Chaque ouverture repart du sprint édité, ou de la première période libre.
  useEffect(() => {
    if (!open) return;
    createSprint.reset();
    updateSprint.reset();
    if (sprint) {
      setName(sprint.name);
      setGoal(sprint.goal ?? '');
      setStartDate(toDay(sprint.startDate));
      setEndDate(toDay(sprint.endDate));
      return;
    }
    const lastEnd = (sprints ?? [])
      .map((entry) => toDay(entry.endDate))
      .sort()
      .at(-1);
    const firstFreeDay = lastEnd && addDays(lastEnd, 1) > today ? addDays(lastEnd, 1) : today;
    setName('');
    setGoal('');
    setStartDate(firstFreeDay);
    setEndDate(addDays(firstFreeDay, DEFAULT_LENGTH_DAYS));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule l'ouverture réinitialise le formulaire
  }, [open, sprint?.id]);

  const originalStart = sprint ? toDay(sprint.startDate) : null;
  const originalEnd = sprint ? toDay(sprint.endDate) : null;
  const changesStart = startDate !== originalStart;
  const changesEnd = endDate !== originalEnd;

  const dateIssue = useMemo(() => {
    if (!startDate || !endDate) return 'Les dates de début et de fin sont obligatoires.';
    if (endDate < startDate) return 'La date de fin doit être postérieure à la date de début.';
    if (changesStart && startDate < today) {
      return "La date de début doit être aujourd'hui ou plus tard.";
    }
    if (changesEnd && endDate < today) return "La date de fin doit être aujourd'hui ou plus tard.";
    if (!changesStart && !changesEnd) return null;
    const overlap = (sprints ?? []).find(
      (entry) => entry.id !== sprint?.id && sprintPeriodsOverlap({ startDate, endDate }, entry),
    );
    return overlap
      ? `Ces dates chevauchent le sprint « ${overlap.name} » (${formatSprintDate(overlap.startDate)} – ${formatSprintDate(overlap.endDate)}).`
      : null;
  }, [startDate, endDate, changesStart, changesEnd, today, sprints, sprint?.id]);

  const invalid = name.trim().length < 2 || Boolean(dateIssue);

  const submit = async () => {
    const fields = {
      name: name.trim(),
      goal: goal.trim() || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    };
    try {
      const saved = sprint
        ? await updateSprint.mutateAsync({ sprintId: sprint.id, input: fields })
        : await createSprint.mutateAsync(fields);
      onSaved?.(saved.id);
      onClose();
    } catch {
      // Le message métier de l'API reste affiché dans le formulaire.
    }
  };

  // Un début déjà passé reste affichable tant qu'il n'est pas modifié.
  const startMin = originalStart && originalStart < today ? originalStart : today;

  return (
    <Modal
      open={open}
      title={sprint ? `Modifier · ${sprint.name}` : 'Nouveau sprint'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={mutation.isPending}
            disabled={invalid}
          >
            {isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <InlineError error={mutation.error} />
        <Field label="Nom" htmlFor="sprint-name" required>
          <Input
            id="sprint-name"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Objectif" htmlFor="sprint-goal">
          <Textarea
            id="sprint-goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début" htmlFor="sprint-start" required>
            <Input
              id="sprint-start"
              type="date"
              min={startMin}
              value={startDate}
              invalid={Boolean(dateIssue)}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </Field>
          <Field label="Fin" htmlFor="sprint-end" required>
            <Input
              id="sprint-end"
              type="date"
              min={startDate > today ? startDate : today}
              value={endDate}
              invalid={Boolean(dateIssue)}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </Field>
        </div>
        {dateIssue && (
          <p
            role="alert"
            className="text-warning flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-sm dark:bg-orange-950/40"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            {dateIssue}
          </p>
        )}
      </div>
    </Modal>
  );
}
