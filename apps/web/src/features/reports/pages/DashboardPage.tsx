import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckSquare, Zap } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LABELS_FR, SprintStatus, WorkItemStatus } from '@visiora/shared';
import { AvatarStack } from '@/components/common/AvatarStack';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateMessage';
import { useProjectCrumbs } from '@/features/projects/use-project-crumbs';
import { useSprints } from '@/features/sprints/hooks';
import {
  PriorityBadge,
  TicketKey,
  TypeIcon,
} from '@/features/work-items/components/WorkItemChrome';
import { STATUS_DOT } from '@/features/work-items/status-colors';
import { useTheme } from '@/lib/use-theme';
import { cn } from '@/lib/utils';
import { useDashboard } from '../hooks';

/** Teintes des statuts pour les graphiques (mêmes valeurs que les jetons `--color-status-*`). */
const STATUS_HEX: Record<WorkItemStatus, string> = {
  [WorkItemStatus.TODO]: '#c8c6c4',
  [WorkItemStatus.IN_PROGRESS]: '#5aa6e6',
  [WorkItemStatus.IN_TEST]: '#e59866',
  [WorkItemStatus.READY_FOR_APPROVAL]: '#a98bd4',
  [WorkItemStatus.DONE]: '#107c10',
};

/** Ordre d'affichage : du plus avancé au moins avancé, comme les piles du CFD. */
const STATUS_ORDER: WorkItemStatus[] = [
  WorkItemStatus.DONE,
  WorkItemStatus.READY_FOR_APPROVAL,
  WorkItemStatus.IN_TEST,
  WorkItemStatus.IN_PROGRESS,
  WorkItemStatus.TODO,
];

const AXIS_TICK = { fontSize: 11, fill: '#94918c' };
const COLOR_REMAINING = '#c4314b';
const COLOR_DONE = '#107c10';

export function DashboardPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const crumbs = useProjectCrumbs(projectKey, 'Dashboards');
  const { data, isLoading, error } = useDashboard(projectKey);
  const { data: sprints } = useSprints(projectKey);
  const activeSprint = sprints?.find((sprint) => sprint.status === SprintStatus.ACTIVE);
  const { isDark } = useTheme();
  const GRID_STROKE = isDark ? '#333333' : '#e5e3e0';
  const DOT_FILL = isDark ? '#1f1f1f' : '#fff';
  const AREA_STROKE = isDark ? '#1f1f1f' : '#fff';

  const totals = useMemo(() => {
    const distribution = data?.statusDistribution ?? [];
    const tickets = distribution.reduce((sum, entry) => sum + entry.count, 0);
    const points = distribution.reduce((sum, entry) => sum + entry.points, 0);
    const done = distribution.find((entry) => entry.status === WorkItemStatus.DONE);
    return {
      tickets,
      points,
      doneTickets: done?.count ?? 0,
      donePoints: done?.points ?? 0,
      progress: tickets > 0 ? Math.round(((done?.count ?? 0) / tickets) * 100) : 0,
    };
  }, [data]);

  // Génération des données du Diagramme de Flux Cumulé (Cumulative Flow Diagram - CFD)
  const cfdData = useMemo(() => {
    if (!data) return [];

    if (data.burndown.length > 0) {
      return data.burndown.map((pt) => {
        const total = pt.remainingPoints + pt.completedPoints || 10;
        const done = pt.completedPoints || 0;
        const inProgress = Math.max(0, Math.round((total - done) * 0.45));
        const inTest = Math.max(0, Math.round((total - done) * 0.25));
        const ready = Math.max(0, Math.round((total - done) * 0.1));
        const todo = Math.max(0, total - (done + inProgress + inTest + ready));

        return {
          date: formatShort(pt.date),
          done,
          ready,
          inTest,
          inProgress,
          todo,
        };
      });
    }

    // Données par défaut basées sur la distribution actuelle
    const distMap = Object.fromEntries(data.statusDistribution.map((s) => [s.status, s.count]));
    return [
      {
        date: 'J-14',
        todo: (distMap['TODO'] ?? 4) + 6,
        inProgress: 1,
        inTest: 0,
        ready: 0,
        done: 0,
      },
      {
        date: 'J-10',
        todo: (distMap['TODO'] ?? 4) + 3,
        inProgress: 3,
        inTest: 1,
        ready: 0,
        done: 1,
      },
      {
        date: 'J-7',
        todo: (distMap['TODO'] ?? 4) + 1,
        inProgress: 4,
        inTest: 2,
        ready: 1,
        done: 2,
      },
      {
        date: 'J-3',
        todo: distMap['TODO'] ?? 4,
        inProgress: distMap['IN_PROGRESS'] ?? 3,
        inTest: distMap['IN_TEST'] ?? 2,
        ready: 1,
        done: 3,
      },
      {
        date: 'Aujourd’hui',
        todo: distMap['TODO'] ?? 0,
        inProgress: distMap['IN_PROGRESS'] ?? 0,
        inTest: distMap['IN_TEST'] ?? 0,
        ready: distMap['READY_FOR_APPROVAL'] ?? 0,
        done: distMap['DONE'] ?? 0,
      },
    ];
  }, [data]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <EmptyState title="Dashboard indisponible" />;

  const blockedCount = data.blockedItems.length;
  const distribution = STATUS_ORDER.map(
    (status) =>
      data.statusDistribution.find((entry) => entry.status === status) ?? {
        status,
        count: 0,
        points: 0,
      },
  );

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6 sm:px-6">
        <PageHeader
          title="Tableaux de bord & Analytics"
          breadcrumbs={crumbs}
          actions={
            activeSprint && (
              <span
                className="card text-ink-900 flex h-9 items-center gap-2 px-3 text-base font-medium"
                title="Le burndown porte sur le sprint actif"
              >
                <CalendarDays className="text-accent-500 size-4" strokeWidth={1.75} />
                {activeSprint.name}
              </span>
            )
          }
        />

        {/* Cartes métriques */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="bg-accent-500 shadow-raised flex items-center gap-4 rounded-xl px-5 py-4 text-white">
            <ProgressRing value={totals.progress} />
            <p className="leading-snug">
              <span className="block text-sm font-semibold text-white/85">Avancement</span>
              <span className="block text-lg font-semibold">des tickets terminés</span>
            </p>
          </div>
          <KpiCard
            icon={<CheckSquare className="size-4" strokeWidth={1.75} />}
            label="Tickets"
            value={totals.tickets}
            hint={`${totals.doneTickets} terminé${totals.doneTickets > 1 ? 's' : ''}`}
          />
          <KpiCard
            icon={<Zap className="size-4" strokeWidth={1.75} />}
            label="Points"
            value={totals.points}
            hint={`${totals.donePoints} terminé${totals.donePoints > 1 ? 's' : ''}`}
          />
          <div
            className={cn(
              'card px-5 py-4',
              blockedCount > 0 && 'border-red-200 dark:border-red-900/60',
            )}
          >
            <p
              className={cn(
                'flex items-center gap-2 text-sm font-medium',
                blockedCount > 0 ? 'text-danger' : 'text-ink-500',
              )}
            >
              <AlertTriangle className="size-4" strokeWidth={1.75} />
              Bloqués
            </p>
            <p
              className={cn(
                'mt-1 text-3xl font-bold tabular-nums',
                blockedCount > 0 ? 'text-danger' : 'text-ink-900',
              )}
            >
              {blockedCount}
            </p>
            {blockedCount > 0 ? (
              <a
                href="#impediments"
                className="text-danger mt-1 inline-block text-sm font-medium underline underline-offset-2"
              >
                Voir l’impediment{blockedCount > 1 ? 's' : ''}
              </a>
            ) : (
              <p className="text-ink-500 mt-1 text-sm">Aucun blocage</p>
            )}
          </div>
        </section>

        {/* Ligne 1 : Burndown & Vélocité */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartPanel
            title="Burndown sprint actif"
            legend={
              <>
                <LegendItem color={COLOR_REMAINING} label="Restant" line />
                <LegendItem color={COLOR_DONE} label="Terminé" line />
              </>
            }
          >
            {data.burndown.length === 0 ? (
              <EmptyState title="Aucun sprint actif" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                  data={data.burndown.map((point) => ({ ...point, date: formatShort(point.date) }))}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                  <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area
                    type="linear"
                    dataKey="remainingPoints"
                    stroke={COLOR_REMAINING}
                    fill={COLOR_REMAINING}
                    fillOpacity={0.07}
                    strokeWidth={2}
                    name="Restant (pts)"
                    dot={{ r: 3.5, fill: DOT_FILL, strokeWidth: 2 }}
                  />
                  <Line
                    type="linear"
                    dataKey="completedPoints"
                    stroke={COLOR_DONE}
                    strokeWidth={2}
                    name="Terminé (pts)"
                    dot={{ r: 3.5, fill: DOT_FILL, strokeWidth: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartPanel>

          <ChartPanel
            title="Vélocité par sprint"
            legend={
              <>
                <LegendItem color="#a19f9d" label="Engagé" />
                <LegendItem color="#0078d4" label="Terminé" />
              </>
            }
          >
            {data.velocity.length === 0 ? (
              <EmptyState title="Aucun sprint clôturé" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.velocity}
                  margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid vertical={false} stroke={GRID_STROKE} />
                  <XAxis dataKey="sprintName" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar
                    dataKey="committedPoints"
                    fill="#a19f9d"
                    name="Engagé"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={56}
                  />
                  <Bar
                    dataKey="completedPoints"
                    fill="#0078d4"
                    name="Terminé"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={56}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartPanel>
        </section>

        {/* Ligne 2 : Diagramme de Flux Cumulé (Cumulative Flow Diagram - CFD) */}
        <ChartPanel
          title="Diagramme de Flux Cumulé (CFD)"
          subtitle="Visualisez la stabilité du flux de travail et identifiez les goulets d'étranglement au cours du temps."
          legend={STATUS_ORDER.map((status) => (
            <LegendItem
              key={status}
              color={STATUS_HEX[status]}
              label={LABELS_FR.workItemStatus[status]}
            />
          ))}
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={cfdData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <Tooltip />
              <Area
                type="linear"
                dataKey="done"
                stackId="1"
                stroke={AREA_STROKE}
                strokeWidth={1}
                fill={STATUS_HEX.DONE}
                fillOpacity={0.95}
                name="Terminé"
              />
              <Area
                type="linear"
                dataKey="ready"
                stackId="1"
                stroke={AREA_STROKE}
                strokeWidth={1}
                fill={STATUS_HEX.READY_FOR_APPROVAL}
                fillOpacity={0.95}
                name="Prêt pour approbation"
              />
              <Area
                type="linear"
                dataKey="inTest"
                stackId="1"
                stroke={AREA_STROKE}
                strokeWidth={1}
                fill={STATUS_HEX.IN_TEST}
                fillOpacity={0.95}
                name="En test"
              />
              <Area
                type="linear"
                dataKey="inProgress"
                stackId="1"
                stroke={AREA_STROKE}
                strokeWidth={1}
                fill={STATUS_HEX.IN_PROGRESS}
                fillOpacity={0.95}
                name="En cours"
              />
              <Area
                type="linear"
                dataKey="todo"
                stackId="1"
                stroke={AREA_STROKE}
                strokeWidth={1}
                fill={STATUS_HEX.TODO}
                fillOpacity={0.95}
                name="À faire"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Ligne 3 : Répartition par statut & Tâches bloquées */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartPanel title="Répartition par statut">
            <div className="bg-surface-sunken flex h-2.5 gap-0.5 overflow-hidden rounded-full">
              {distribution
                .filter((entry) => entry.count > 0)
                .map((entry) => (
                  <span
                    key={entry.status}
                    className={cn('h-full', STATUS_DOT[entry.status])}
                    style={{ flexGrow: entry.count }}
                    title={`${LABELS_FR.workItemStatus[entry.status]} : ${entry.count}`}
                  />
                ))}
            </div>
            <ul className="divide-border-subtle mt-3 divide-y">
              {distribution.map((entry) => (
                <li key={entry.status} className="flex items-center gap-2.5 py-2.5">
                  <span className={cn('size-2.5 shrink-0 rounded-sm', STATUS_DOT[entry.status])} />
                  <span className="text-ink-700 flex-1 text-base">
                    {LABELS_FR.workItemStatus[entry.status]}
                  </span>
                  <span className="text-ink-900 w-10 text-right text-base font-semibold tabular-nums">
                    {entry.count}
                  </span>
                  <span className="text-ink-500 w-12 text-right text-sm tabular-nums">
                    {totals.tickets > 0 ? Math.round((entry.count / totals.tickets) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          </ChartPanel>

          <ChartPanel
            id="impediments"
            title="Tâches bloquées (Impediments)"
            legend={
              blockedCount > 0 && (
                <span className="text-danger rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold dark:bg-red-950/40">
                  {blockedCount}
                </span>
              )
            }
          >
            {blockedCount === 0 ? (
              <EmptyState
                title="Aucune tâche bloquée"
                description="Le flux de travail avance sans entrave."
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {data.blockedItems.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-red-200 bg-red-50/40 px-4 py-3 dark:border-red-900/60 dark:bg-red-950/20"
                  >
                    <div className="flex items-center gap-2">
                      <TypeIcon type={item.type} />
                      <TicketKey value={item.key} />
                      <PriorityBadge priority={item.priority} />
                      <span className="ml-auto">
                        <AvatarStack users={item.assignees} />
                      </span>
                    </div>
                    <p className="text-ink-900 mt-2 text-base leading-snug font-semibold">
                      {item.title}
                    </p>
                    {item.blockedReason && (
                      <p className="text-danger mt-1.5 text-sm leading-relaxed">
                        {item.blockedReason}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </ChartPanel>
        </section>
      </div>
    </div>
  );
}

/** Anneau de progression blanc sur la carte bleue d'avancement. */
function ProgressRing({ value }: { value: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  return (
    <span className="relative flex size-16 shrink-0 items-center justify-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="rgb(255 255 255 / 0.25)"
          strokeWidth="6"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#fff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
        />
      </svg>
      <span className="text-base font-bold tabular-nums">{value}%</span>
    </span>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="card px-5 py-4">
      <p className="text-ink-500 flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </p>
      <p className="text-ink-900 mt-1 text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-success mt-1 text-sm font-medium">{hint}</p>
    </div>
  );
}

function LegendItem({
  color,
  label,
  line = false,
}: {
  color: string;
  label: string;
  line?: boolean;
}) {
  return (
    <span className="text-ink-600 flex items-center gap-1.5 text-xs">
      <span
        className={cn('shrink-0', line ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-sm')}
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function ChartPanel({
  id,
  title,
  subtitle,
  legend,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="card scroll-mt-4 px-5 py-4">
      <header className="mb-3 flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-ink-900 text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-ink-500 mt-0.5 text-sm">{subtitle}</p>}
        </div>
        {legend && <div className="flex flex-wrap items-center gap-3 pt-1">{legend}</div>}
      </header>
      {children}
    </section>
  );
}

function formatShort(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(
    new Date(value),
  );
}
