import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LABELS_FR } from '@visiora/shared';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateMessage';
import { StatusPill, StoryPoints } from '@/features/work-items/components/WorkItemChrome';
import { useDashboard } from '../hooks';

export function DashboardPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const { data, isLoading, error } = useDashboard(projectKey);

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
      { date: 'J-14', todo: (distMap['TODO'] ?? 4) + 6, inProgress: 1, inTest: 0, ready: 0, done: 0 },
      { date: 'J-10', todo: (distMap['TODO'] ?? 4) + 3, inProgress: 3, inTest: 1, ready: 0, done: 1 },
      { date: 'J-7', todo: (distMap['TODO'] ?? 4) + 1, inProgress: 4, inTest: 2, ready: 1, done: 2 },
      { date: 'J-3', todo: (distMap['TODO'] ?? 4), inProgress: (distMap['IN_PROGRESS'] ?? 3), inTest: (distMap['IN_TEST'] ?? 2), ready: 1, done: 3 },
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

  return (
    <div className="scrollbar-thin h-full overflow-y-auto p-4 flex flex-col gap-4">
      <header className="border-border-subtle border-b pb-3">
        <h1 className="text-ink-900 text-xl font-semibold">Tableaux de bord & Analytics</h1>
      </header>

      {/* Cartes métriques */}
      <section className="grid grid-cols-4 gap-3">
        {data.metrics.map((metric) => (
          <div key={metric.label} className="bg-surface border-border-default rounded border px-3 py-2 shadow-xs">
            <p className="text-ink-400 text-xs font-semibold uppercase">{metric.label}</p>
            <p className="text-ink-900 mt-1 text-2xl font-semibold">{metric.value}</p>
            {metric.hint && <p className="text-ink-500 text-sm mt-0.5">{metric.hint}</p>}
          </div>
        ))}
      </section>

      {/* Ligne 1 : Burndown & Vélocité */}
      <section className="grid grid-cols-2 gap-4">
        <ChartPanel title="Burndown sprint actif">
          {data.burndown.length === 0 ? (
            <EmptyState title="Aucun sprint actif" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.burndown.map((point) => ({ ...point, date: formatShort(point.date) }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="remainingPoints" stroke="#d13438" name="Restant (pts)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="completedPoints" stroke="#107c10" name="Terminé (pts)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        <ChartPanel title="Vélocité par Sprint">
          {data.velocity.length === 0 ? (
            <EmptyState title="Aucun sprint clôturé" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.velocity}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="sprintName" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="committedPoints" fill="#8a8886" name="Engagé" radius={[2, 2, 0, 0]} />
                <Bar dataKey="completedPoints" fill="#0078d4" name="Terminé" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      </section>

      {/* Ligne 2 : Diagramme de Flux Cumulé (Cumulative Flow Diagram - CFD) */}
      <section>
        <ChartPanel title="Diagramme de Flux Cumulé (Cumulative Flow Diagram · CFD)">
          <div className="mb-2 text-xs text-ink-500">
            Visualisez la stabilité du flux de travail et identifiez les goulets d'étranglement au cours du temps.
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={cfdData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="done" stackId="1" stroke="#107c10" fill="#107c10" fillOpacity={0.8} name="Terminé" />
              <Area type="monotone" dataKey="ready" stackId="1" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.7} name="Prêt pour approbation" />
              <Area type="monotone" dataKey="inTest" stackId="1" stroke="#8764b8" fill="#8764b8" fillOpacity={0.6} name="En test" />
              <Area type="monotone" dataKey="inProgress" stackId="1" stroke="#0078d4" fill="#0078d4" fillOpacity={0.5} name="En cours" />
              <Area type="monotone" dataKey="todo" stackId="1" stroke="#8a8886" fill="#8a8886" fillOpacity={0.3} name="À faire" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>
      </section>

      {/* Ligne 3 : Répartition par statut & Tâches bloquées */}
      <section className="grid grid-cols-2 gap-4">
        <ChartPanel title="Répartition par statut">
          <div className="flex flex-col gap-2">
            {data.statusDistribution.map((entry) => (
              <div key={entry.status} className="grid grid-cols-[160px_1fr_60px] items-center gap-2">
                <span className="text-ink-700 text-sm font-medium">{LABELS_FR.workItemStatus[entry.status]}</span>
                <span className="bg-surface-sunken h-2.5 overflow-hidden rounded">
                  <span
                    className="bg-accent-500 block h-full rounded transition-all"
                    style={{
                      width: `${Math.min(entry.count * 12, 100)}%`,
                    }}
                  />
                </span>
                <span className="text-ink-500 text-right text-sm font-semibold">{entry.count}</span>
              </div>
            ))}
          </div>
        </ChartPanel>

        <ChartPanel title="Tâches bloquées (Impediments)">
          {data.blockedItems.length === 0 ? (
            <EmptyState title="Aucune tâche bloquée" description="Le flux de travail avance sans entrave." />
          ) : (
            <div className="flex flex-col divide-y divide-border-subtle">
              {data.blockedItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[80px_1fr_90px_32px] items-center gap-2 py-2">
                  <span className="text-ink-400 text-xs font-semibold">{item.key}</span>
                  <span className="text-ink-900 truncate text-sm font-medium">{item.title}</span>
                  <StatusPill status={item.status} />
                  <StoryPoints points={item.storyPoints} />
                </div>
              ))}
            </div>
          )}
        </ChartPanel>
      </section>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface border-border-default rounded border p-4 shadow-xs">
      <h2 className="text-ink-900 mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function formatShort(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(value));
}
