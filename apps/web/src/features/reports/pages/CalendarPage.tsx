import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, Flag, ListTodo } from 'lucide-react';
import type { CalendarEvent } from '@visiora/shared';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateMessage';
import { useCalendar } from '../hooks';

export function CalendarPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const { data, isLoading, error } = useCalendar(projectKey);
  const groups = useMemo(() => groupByMonth(data ?? []), [data]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="flex h-full flex-col">
      <header className="border-border-subtle flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <h1 className="text-ink-900 text-xl font-semibold">Calendrier</h1>
        <span className="text-ink-400 text-sm">{data?.length ?? 0} evenement(s)</span>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        {!data || data.length === 0 ? (
          <EmptyState title="Calendrier vide" />
        ) : (
          <div className="flex max-w-4xl flex-col gap-4">
            {groups.map((group) => (
              <section key={group.month}>
                <h2 className="text-ink-900 mb-2 text-lg font-semibold">{group.month}</h2>
                <div className="border-border-default overflow-hidden rounded border">
                  {group.events.map((event) => (
                    <div
                      key={`${event.type}-${event.id}`}
                      className="border-border-subtle grid grid-cols-[90px_32px_1fr_120px] items-center gap-2 border-b px-3 py-2 last:border-b-0"
                    >
                      <span className="text-ink-500 text-sm">{formatDay(event.start)}</span>
                      <EventIcon event={event} />
                      <span className="text-ink-900 truncate text-base">{event.title}</span>
                      <span className="text-ink-400 text-sm">{event.type}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventIcon({ event }: { event: CalendarEvent }) {
  const Icon =
    event.type === 'SPRINT' ? CalendarDays : event.type === 'MILESTONE' ? Flag : ListTodo;
  return <Icon className="text-accent-600 size-4" strokeWidth={1.75} />;
}

function groupByMonth(events: CalendarEvent[]) {
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(
      new Date(event.start),
    );
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.entries()].map(([month, monthEvents]) => ({ month, events: monthEvents }));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', weekday: 'short' }).format(new Date(value));
}
