import { useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
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

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <EmptyState title="Dashboard indisponible" />;

  return (
    <div className="scrollbar-thin h-full overflow-y-auto p-4">
      <header className="border-border-subtle mb-4 border-b pb-3">
        <h1 className="text-ink-900 text-xl font-semibold">Tableaux de bord</h1>
      </header>

      <section className="mb-4 grid grid-cols-4 gap-3">
        {data.metrics.map((metric) => (
          <div key={metric.label} className="border-border-default rounded border px-3 py-2">
            <p className="text-ink-400 text-xs font-semibold uppercase">{metric.label}</p>
            <p className="text-ink-900 mt-1 text-2xl font-semibold">{metric.value}</p>
            {metric.hint && <p className="text-ink-500 text-sm">{metric.hint}</p>}
          </div>
        ))}
      </section>

      <section className="mb-4 grid grid-cols-2 gap-4">
        <ChartPanel title="Burndown sprint actif">
          {data.burndown.length === 0 ? (
            <EmptyState title="Aucun sprint actif" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.burndown.map((point) => ({ ...point, date: formatShort(point.date) }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="remainingPoints" stroke="#d13438" name="Restant" />
                <Line type="monotone" dataKey="completedPoints" stroke="#107c10" name="Termine" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>

        <ChartPanel title="Velocite">
          {data.velocity.length === 0 ? (
            <EmptyState title="Aucun sprint cloture" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.velocity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sprintName" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="committedPoints" fill="#8a8886" name="Engage" />
                <Bar dataKey="completedPoints" fill="#0078d4" name="Termine" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartPanel>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <ChartPanel title="Repartition par statut">
          <div className="flex flex-col gap-2">
            {data.statusDistribution.map((entry) => (
              <div key={entry.status} className="grid grid-cols-[150px_1fr_60px] items-center gap-2">
                <span className="text-ink-700 text-sm">{LABELS_FR.workItemStatus[entry.status]}</span>
                <span className="bg-surface-sunken h-2 overflow-hidden rounded">
                  <span
                    className="bg-accent-500 block h-full"
                    style={{
                      width: `${Math.min(entry.count * 12, 100)}%`,
                    }}
                  />
                </span>
                <span className="text-ink-500 text-right text-sm">{entry.count}</span>
              </div>
            ))}
          </div>
        </ChartPanel>

        <ChartPanel title="Taches bloquees">
          {data.blockedItems.length === 0 ? (
            <EmptyState title="Aucune tache bloquee" />
          ) : (
            <div className="flex flex-col divide-y divide-border-subtle">
              {data.blockedItems.map((item) => (
                <div key={item.id} className="grid grid-cols-[80px_1fr_90px_32px] items-center gap-2 py-1.5">
                  <span className="text-ink-400 text-xs font-semibold">{item.key}</span>
                  <span className="text-ink-900 truncate text-base">{item.title}</span>
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
    <section className="border-border-default rounded border p-3">
      <h2 className="text-ink-900 mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function formatShort(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(value));
}
