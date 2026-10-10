import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, CalendarRange } from 'lucide-react';
import {
  SprintStatus,
  WorkItemStatus,
  WorkItemType,
  type RoadmapEpic,
  type SprintSummary,
} from '@visiora/shared';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateMessage';
import { useProjectCrumbs } from '@/features/projects/use-project-crumbs';
import { useRoadmap, useSprints } from '@/features/sprints/hooks';
import {
  StatusPill,
  StoryPoints,
  TicketKey,
  TypeIcon,
} from '@/features/work-items/components/WorkItemChrome';
import { cn } from '@/lib/utils';

type RoadmapView = 'timeline' | 'list';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Largeur minimale d'un jour : en dessous, la frise défile horizontalement. */
const MIN_DAY_WIDTH = 11;

const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const monthShort = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

function startOfDay(value: string | Date): Date {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface Timeline {
  start: Date;
  totalDays: number;
  months: { label: string; offset: number; days: number }[];
  ticks: { label: string; offset: number }[];
  rangeLabel: string;
}

/** Frise du premier au dernier mois couvert par les epics datés et les sprints. */
function buildTimeline(epics: RoadmapEpic[], sprints: SprintSummary[]): Timeline | null {
  const dates = [
    ...epics.flatMap((epic) => [epic.startDate, epic.dueDate]),
    ...sprints.flatMap((sprint) => [sprint.startDate, sprint.endDate]),
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => startOfDay(value).getTime());
  if (dates.length === 0) return null;

  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  const start = new Date(min.getFullYear(), min.getMonth(), 1);
  const end = new Date(max.getFullYear(), max.getMonth() + 1, 1);
  const totalDays = Math.round((end.getTime() - start.getTime()) / DAY_MS);

  const months: Timeline['months'] = [];
  for (let cursor = new Date(start); cursor < end;) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    months.push({
      label: capitalize(monthLabel.format(cursor)),
      offset: Math.round((cursor.getTime() - start.getTime()) / DAY_MS),
      days: Math.round((next.getTime() - cursor.getTime()) / DAY_MS),
    });
    cursor = next;
  }

  const ticks: Timeline['ticks'] = [];
  for (let offset = 0; offset < totalDays; offset += 7) {
    const date = new Date(start.getTime() + offset * DAY_MS);
    ticks.push({
      // Le premier repère de chaque mois porte le nom du mois, les autres seulement le jour.
      label: date.getDate() <= 7 ? dayMonth.format(date) : String(date.getDate()),
      offset,
    });
  }

  const last = new Date(end.getTime() - DAY_MS);
  const rangeLabel =
    start.getFullYear() === last.getFullYear()
      ? `${capitalize(monthShort.format(start).replace('.', ''))} – ${capitalize(monthShort.format(last))} ${last.getFullYear()}`
      : `${capitalize(monthLabel.format(start))} – ${capitalize(monthLabel.format(last))}`;

  return { start, totalDays, months, ticks, rangeLabel };
}

/** Position horizontale (en %) d'une période sur la frise. */
function span(timeline: Timeline, from: string, to: string) {
  const startDay = (startOfDay(from).getTime() - timeline.start.getTime()) / DAY_MS;
  const endDay = (startOfDay(to).getTime() - timeline.start.getTime()) / DAY_MS + 1;
  return {
    left: `${(Math.max(0, startDay) / timeline.totalDays) * 100}%`,
    width: `${(Math.max(1, endDay - Math.max(0, startDay)) / timeline.totalDays) * 100}%`,
  };
}

const SPRINT_BAR: Record<SprintStatus, string> = {
  [SprintStatus.COMPLETED]: 'bg-surface-sunken text-ink-600',
  [SprintStatus.ACTIVE]: 'bg-green-50 text-success dark:bg-green-950/40',
  [SprintStatus.PLANNED]: 'bg-accent-50 text-accent-700',
};

function epicBarClass(status: WorkItemStatus): string {
  if (status === WorkItemStatus.DONE) return 'bg-success border-success text-white';
  if (status === WorkItemStatus.TODO) return 'bg-surface-sunken border-border-strong text-ink-600';
  return 'bg-accent-50 border-accent-400 text-accent-700';
}

export function RoadmapPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const crumbs = useProjectCrumbs(projectKey, 'Roadmap');
  const [view, setView] = useState<RoadmapView>('timeline');
  const { data: epics, isLoading, error } = useRoadmap(projectKey);
  const { data: sprints } = useSprints(projectKey);

  const orderedSprints = useMemo(
    () =>
      [...(sprints ?? [])].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      ),
    [sprints],
  );
  const timeline = useMemo(
    () => buildTimeline(epics ?? [], orderedSprints),
    [epics, orderedSprints],
  );

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  const count = epics?.length ?? 0;

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="space-y-4 px-4 pt-5 pb-6 sm:px-6">
        <PageHeader
          title="Roadmap"
          breadcrumbs={crumbs}
          count={`${count} epic${count > 1 ? 's' : ''}`}
          actions={
            <>
              <div
                className="bg-surface-sunken flex items-center gap-0.5 rounded-lg p-1"
                role="radiogroup"
                aria-label="Affichage de la roadmap"
              >
                {(
                  [
                    ['timeline', 'Chronologie'],
                    ['list', 'Liste'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={view === value}
                    onClick={() => setView(value)}
                    className={cn(
                      'h-7 rounded-md px-3 text-sm font-medium transition-colors',
                      view === value
                        ? 'bg-surface text-accent-700 shadow-raised font-semibold'
                        : 'text-ink-600 hover:text-ink-900',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {timeline && (
                <span className="card text-ink-900 flex h-9 items-center gap-2 px-3 text-base font-medium">
                  <CalendarDays className="text-ink-500 size-4" strokeWidth={1.75} />
                  {timeline.rangeLabel}
                </span>
              )}
            </>
          }
        />

        {!epics || epics.length === 0 ? (
          <div className="card">
            <EmptyState
              title="Roadmap vide"
              description="Ajoutez des dates aux epics du backlog."
            />
          </div>
        ) : view === 'list' || !timeline ? (
          <EpicList epics={epics} />
        ) : (
          <>
            <TimelineView epics={epics} sprints={orderedSprints} timeline={timeline} />
            <Legend />
          </>
        )}
      </div>
    </div>
  );
}

function TimelineView({
  epics,
  sprints,
  timeline,
}: {
  epics: RoadmapEpic[];
  sprints: SprintSummary[];
  timeline: Timeline;
}) {
  const todayOffset = (startOfDay(new Date()).getTime() - timeline.start.getTime()) / DAY_MS;
  const showToday = todayOffset >= 0 && todayOffset < timeline.totalDays;
  const gridLines = (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {timeline.ticks.map((tick) => (
        <span
          key={tick.offset}
          className="border-border-subtle absolute inset-y-0 border-l"
          style={{ left: `${(tick.offset / timeline.totalDays) * 100}%` }}
        />
      ))}
      {showToday && (
        <span
          className="border-danger absolute inset-y-0 border-l-2 border-dashed opacity-60"
          style={{ left: `${(todayOffset / timeline.totalDays) * 100}%` }}
          title="Aujourd'hui"
        />
      )}
    </div>
  );

  return (
    <div className="card scrollbar-thin overflow-x-auto">
      <div
        className="grid grid-cols-[minmax(260px,360px)_1fr]"
        style={{ minWidth: `calc(360px + ${timeline.totalDays * MIN_DAY_WIDTH}px)` }}
      >
        {/* En-tête : mois puis repères hebdomadaires */}
        <div className="border-border-default text-ink-500 flex items-end border-r border-b px-4 pb-2 text-[11px] font-semibold tracking-wider uppercase">
          Epic
        </div>
        <div className="border-border-default border-b">
          <div className="relative h-9">
            {timeline.months.map((month) => (
              <span
                key={month.label}
                className="border-border-default text-ink-900 absolute inset-y-0 flex items-center border-l px-2.5 text-sm font-semibold first:border-l-0"
                style={{
                  left: `${(month.offset / timeline.totalDays) * 100}%`,
                  width: `${(month.days / timeline.totalDays) * 100}%`,
                }}
              >
                {month.label}
              </span>
            ))}
          </div>
          <div className="relative h-7">
            {timeline.ticks.map((tick) => (
              <span
                key={tick.offset}
                className="border-border-subtle text-ink-500 absolute inset-y-0 flex items-center border-l pl-1.5 text-xs whitespace-nowrap"
                style={{ left: `${(tick.offset / timeline.totalDays) * 100}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>

        {/* Bandeau des sprints */}
        <div className="border-border-default text-ink-600 flex items-center border-r border-b px-4 py-2.5 text-sm font-medium">
          Sprints
        </div>
        <div className="border-border-default relative border-b py-2.5">
          {gridLines}
          <div className="relative h-6">
            {sprints.map((sprint) => (
              <span
                key={sprint.id}
                className={cn(
                  'absolute inset-y-0 flex items-center truncate rounded-md px-2 text-xs font-semibold',
                  SPRINT_BAR[sprint.status],
                )}
                style={span(timeline, sprint.startDate, sprint.endDate)}
                title={sprint.name}
              >
                {sprint.name}
              </span>
            ))}
          </div>
        </div>

        {epics.map((epic) => (
          <EpicTimelineRow key={epic.id} epic={epic} timeline={timeline} gridLines={gridLines} />
        ))}
      </div>
    </div>
  );
}

function EpicTimelineRow({
  epic,
  timeline,
  gridLines,
}: {
  epic: RoadmapEpic;
  timeline: Timeline;
  gridLines: React.ReactNode;
}) {
  const planned = epic.startDate && epic.dueDate;
  return (
    <>
      <div className="border-border-default border-r border-b px-4 py-3.5">
        <div className="flex items-start gap-3">
          <TypeIcon type={WorkItemType.EPIC} boxed />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <TicketKey value={epic.key} />
              <StatusPill status={epic.status} />
              {epic.rolledUpPoints ? (
                <StoryPoints points={epic.rolledUpPoints} />
              ) : (
                <span className="bg-surface-sunken text-ink-500 inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-semibold">
                  —
                </span>
              )}
            </div>
            <h2 className="text-ink-900 mt-1 text-base leading-snug font-semibold">{epic.title}</h2>
            <p className="text-ink-500 mt-1 text-xs">
              {formatDate(epic.startDate)} – {formatDate(epic.dueDate)}
            </p>
          </div>
        </div>
      </div>
      <div className="border-border-default relative border-b">
        {gridLines}
        {planned ? (
          <div className="relative flex h-full items-center">
            <span
              className={cn(
                'absolute flex h-8 items-center truncate rounded-lg border px-3 text-sm font-semibold',
                epicBarClass(epic.status),
              )}
              style={span(timeline, epic.startDate as string, epic.dueDate as string)}
              title={`${epic.key} · ${formatDate(epic.startDate)} – ${formatDate(epic.dueDate)}`}
            >
              {epic.doneChildCount}/{epic.childCount} éléments terminés
            </span>
          </div>
        ) : (
          <p className="text-ink-400 relative flex h-full items-center px-4 text-sm italic">
            Non planifié
          </p>
        )}
      </div>
    </>
  );
}

function Legend() {
  return (
    <div className="text-ink-600 flex flex-wrap items-center gap-5 text-sm">
      <span className="flex items-center gap-2">
        <span className="bg-success h-3 w-5 rounded" /> Terminé
      </span>
      <span className="flex items-center gap-2">
        <span className="bg-accent-50 border-accent-400 h-3 w-5 rounded border" /> En cours
      </span>
      <span className="flex items-center gap-2">
        <span className="bg-surface-sunken border-border-strong h-3 w-5 rounded border" /> À faire
      </span>
    </div>
  );
}

/** Vue « Liste » : une carte par epic, ordre chronologique. */
function EpicList({ epics }: { epics: RoadmapEpic[] }) {
  return (
    <div className="flex max-w-5xl flex-col gap-3">
      {epics.map((epic) => {
        const ratio = epic.childCount > 0 ? epic.doneChildCount / epic.childCount : 0;
        return (
          <article key={epic.id} className="card px-4 py-3.5">
            <div className="flex items-start gap-3">
              <TypeIcon type={WorkItemType.EPIC} boxed />
              <div className="min-w-0 flex-1">
                <TicketKey value={epic.key} />
                <h2 className="text-ink-900 truncate text-lg font-semibold">{epic.title}</h2>
              </div>
              <StatusPill status={epic.status} />
              <StoryPoints points={epic.rolledUpPoints || null} />
            </div>
            <div className="text-ink-500 mt-3 flex items-center gap-2 text-sm">
              <CalendarRange className="size-3.5" strokeWidth={1.75} />
              {formatDate(epic.startDate)} – {formatDate(epic.dueDate)}
              <span className="ml-auto flex items-center gap-2">
                <span className="bg-surface-sunken block h-1.5 w-24 overflow-hidden rounded-full">
                  <span
                    className="bg-success block h-full rounded-full"
                    style={{ width: `${ratio * 100}%` }}
                  />
                </span>
                {epic.doneChildCount}/{epic.childCount} éléments terminés
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return 'Non planifié';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
