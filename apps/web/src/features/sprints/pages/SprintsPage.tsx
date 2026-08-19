import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, FileText, Flag, Plus, Save, XCircle } from 'lucide-react';
import type { RetrospectiveItemInput, SprintDetail, SprintStatus } from '@visiora/shared';
import { LABELS_FR, RetroCategory, SprintStatus as SprintStatusEnum } from '@visiora/shared';
import { EmptyState, ErrorState, InlineError, LoadingState } from '@/components/common/StateMessage';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useProjectPermissions } from '@/features/projects/hooks';
import { StatusPill, StoryPoints } from '@/features/work-items/components/WorkItemChrome';
import { SprintReportDialog } from '../components/SprintReportDialog';
import {
  useCloseSprint,
  useCreateSprint,
  useSprint,
  useSprints,
  useUpdateRetrospective,
} from '../hooks';

const today = () => new Date().toISOString().slice(0, 10);

export function SprintsPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { data: sprints, isLoading, error } = useSprints(projectKey);
  const { data: selected, isLoading: detailLoading } = useSprint(projectKey, selectedId);
  const { can } = useProjectPermissions(projectKey);
  const closeSprint = useCloseSprint(projectKey);

  useEffect(() => {
    if (selectedId || !sprints?.length) return;
    const defaultSprint =
      sprints.find((sprint) => sprint.status === SprintStatusEnum.ACTIVE) ?? sprints[0];
    if (!defaultSprint) return;
    setSelectedId(defaultSprint.id);
  }, [selectedId, sprints]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="grid h-full min-h-0 grid-cols-[320px_1fr]">
      <aside className="border-border-default flex min-h-0 flex-col border-r">
        <header className="border-border-subtle flex items-center gap-2 border-b px-3 py-2">
          <h1 className="text-ink-900 text-xl font-semibold">Sprints</h1>
          {can('sprint:manage') && (
            <Button variant="primary" size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" strokeWidth={2.5} />
              Nouveau
            </Button>
          )}
        </header>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          {(sprints ?? []).length === 0 ? (
            <EmptyState title="Aucun sprint" description="Creez le premier sprint du projet." />
          ) : (
            sprints?.map((sprint) => (
              <button
                key={sprint.id}
                type="button"
                onClick={() => setSelectedId(sprint.id)}
                className="border-border-subtle hover:bg-surface-muted flex w-full flex-col gap-1 border-b px-3 py-2 text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="text-ink-900 min-w-0 flex-1 truncate text-base font-semibold">
                    {sprint.name}
                  </span>
                  <SprintBadge status={sprint.status} />
                </span>
                <span className="text-ink-400 text-xs">
                  {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                </span>
                <ProgressBar done={sprint.liveCompletedPoints} total={sprint.liveCommittedPoints} />
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="min-h-0 overflow-y-auto">
        {detailLoading ? (
          <LoadingState />
        ) : !selected ? (
          <EmptyState title="Planification vide" />
        ) : (
          <SprintDetailView
            sprint={selected}
            canClose={can('sprint:close')}
            onCloseSprint={() => closeSprint.mutate({ sprintId: selected.id, input: {} })}
            closing={closeSprint.isPending}
            projectRef={projectKey}
          />
        )}
      </main>

      <CreateSprintDialog
        projectRef={projectKey}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(sprintId) => setSelectedId(sprintId)}
      />
    </div>
  );
}

function SprintDetailView({
  sprint,
  canClose,
  closing,
  onCloseSprint,
  projectRef,
}: {
  sprint: SprintDetail;
  canClose: boolean;
  closing: boolean;
  onCloseSprint: () => void;
  projectRef: string;
}) {
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-4">
      <section className="border-border-subtle border-b pb-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-ink-900 truncate text-2xl font-semibold">{sprint.name}</h2>
            <p className="text-ink-500 text-base">
              {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
            </p>
          </div>
          <SprintBadge status={sprint.status} />
          <Button
            variant="ghost"
            onClick={() => setReportOpen(true)}
            className="gap-1.5 text-xs text-ink-700 hover:text-ink-900"
          >
            <FileText className="size-3.5 text-accent-600" />
            <span>Rapport</span>
          </Button>
          {canClose && sprint.status !== SprintStatusEnum.COMPLETED && (
            <Button variant="secondary" onClick={onCloseSprint} loading={closing}>
              <Flag className="size-3.5" strokeWidth={2} />
              Clôturer
            </Button>
          )}
        </div>
        {sprint.goal && <p className="text-ink-700 mt-2 max-w-3xl text-base">{sprint.goal}</p>}
      </section>

      <SprintReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        sprint={sprint}
        projectName={projectRef}
      />

      <section className="grid grid-cols-4 gap-3">
        <Metric label="Tickets" value={`${sprint.completedItems}/${sprint.totalItems}`} />
        <Metric label="Points live" value={`${sprint.liveCompletedPoints}/${sprint.liveCommittedPoints}`} />
        <Metric label="Points engages" value={sprint.committedPoints ?? '-'} />
        <Metric label="Points termines" value={sprint.completedPoints ?? '-'} />
      </section>

      <section>
        <h3 className="text-ink-900 mb-2 text-lg font-semibold">Tickets du sprint</h3>
        <div className="border-border-default overflow-hidden rounded border">
          {sprint.items.length === 0 ? (
            <EmptyState title="Aucun ticket affecte" />
          ) : (
            sprint.items.map((item) => (
              <div
                key={item.id}
                className="border-border-subtle grid grid-cols-[90px_1fr_120px_60px] items-center gap-2 border-b px-3 py-1.5 last:border-b-0"
              >
                <span className="text-ink-400 text-xs font-semibold">{item.key}</span>
                <span className="text-ink-900 truncate text-base">{item.title}</span>
                <StatusPill status={item.status} />
                <StoryPoints points={item.storyPoints} />
              </div>
            ))
          )}
        </div>
      </section>

      <RetrospectiveEditor projectRef={projectRef} sprint={sprint} />
    </div>
  );
}

function CreateSprintDialog({
  projectRef,
  open,
  onClose,
  onCreated,
}: {
  projectRef: string;
  open: boolean;
  onClose: () => void;
  onCreated: (sprintId: string) => void;
}) {
  const createSprint = useCreateSprint(projectRef);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());

  const submit = async () => {
    const sprint = await createSprint.mutateAsync({
      name,
      goal: goal || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
    onCreated(sprint.id);
    setName('');
    setGoal('');
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Nouveau sprint"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={submit} loading={createSprint.isPending}>
            Creer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <InlineError error={createSprint.error} />
        <Field label="Nom" htmlFor="sprint-name" required>
          <Input id="sprint-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Objectif" htmlFor="sprint-goal">
          <Textarea id="sprint-goal" value={goal} onChange={(event) => setGoal(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Debut" htmlFor="sprint-start" required>
            <Input
              id="sprint-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </Field>
          <Field label="Fin" htmlFor="sprint-end" required>
            <Input
              id="sprint-end"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function RetrospectiveEditor({ projectRef, sprint }: { projectRef: string; sprint: SprintDetail }) {
  const { can } = useProjectPermissions(projectRef);
  const updateRetro = useUpdateRetrospective(projectRef);
  const [summary, setSummary] = useState(sprint.retroSummary ?? '');
  const [items, setItems] = useState<RetrospectiveItemInput[]>([]);

  useEffect(() => {
    setSummary(sprint.retroSummary ?? '');
    setItems(
      sprint.retrospectiveItems.map((item) => ({
        id: item.id,
        category: item.category,
        content: item.content,
        isDone: item.isDone,
      })),
    );
  }, [sprint]);

  const addItem = (category: RetrospectiveItemInput['category']) =>
    setItems((current) => [...current, { category, content: '', isDone: false }]);

  const save = () =>
    updateRetro.mutate({ sprintId: sprint.id, input: { retroSummary: summary || null, items } });

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-ink-900 text-lg font-semibold">Retrospective</h3>
        {can('retro:manage') && (
          <Button size="sm" className="ml-auto" onClick={save} loading={updateRetro.isPending}>
            <Save className="size-3.5" strokeWidth={2} />
            Enregistrer
          </Button>
        )}
      </div>
      <InlineError error={updateRetro.error} />
      <Textarea
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        placeholder="Synthese de la retrospective"
        disabled={!can('retro:manage')}
        className="mb-3"
      />
      <div className="grid grid-cols-3 gap-3">
        {Object.values(RetroCategory).map((category) => (
          <div key={category} className="border-border-default rounded border">
            <div className="border-border-subtle flex items-center border-b px-2 py-1">
              <span className="text-ink-700 text-sm font-semibold">
                {LABELS_FR.retroCategory[category]}
              </span>
              {can('retro:manage') && (
                <button
                  type="button"
                  onClick={() => addItem(category)}
                  className="text-accent-700 hover:bg-accent-50 ml-auto rounded p-1"
                  aria-label="Ajouter"
                >
                  <Plus className="size-3.5" strokeWidth={2} />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1 p-2">
              {items
                .filter((item) => item.category === category)
                .map((item, index) => (
                  <div key={`${category}-${index}`} className="flex items-start gap-1">
                    <button
                      type="button"
                      disabled={!can('retro:manage')}
                      onClick={() =>
                        setItems((current) =>
                          current.map((entry) =>
                            entry === item ? { ...entry, isDone: !entry.isDone } : entry,
                          ),
                        )
                      }
                      className="text-ink-400 mt-1"
                      aria-label={item.isDone ? 'Marquer a faire' : 'Marquer fait'}
                    >
                      {item.isDone ? (
                        <CheckCircle2 className="size-4 text-green-700" strokeWidth={1.75} />
                      ) : (
                        <XCircle className="size-4" strokeWidth={1.75} />
                      )}
                    </button>
                    <Textarea
                      value={item.content}
                      disabled={!can('retro:manage')}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((entry) =>
                            entry === item ? { ...entry, content: event.target.value } : entry,
                          ),
                        )
                      }
                      className="min-h-10"
                    />
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-border-default rounded border px-3 py-2">
      <p className="text-ink-400 text-xs font-semibold uppercase">{label}</p>
      <p className="text-ink-900 mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SprintBadge({ status }: { status: SprintStatus }) {
  return (
    <span className="bg-surface-sunken text-ink-700 rounded px-1.5 py-0.5 text-xs font-semibold">
      {LABELS_FR.sprintStatus[status]}
    </span>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const width = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span className="bg-surface-sunken block h-1.5 overflow-hidden rounded">
      <span className="bg-accent-500 block h-full" style={{ width: `${Math.min(width, 100)}%` }} />
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(value),
  );
}
