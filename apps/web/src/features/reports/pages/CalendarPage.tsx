import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, Flag, ListTodo } from 'lucide-react';
import type { CalendarEvent, CalendarEventType } from '@visiora/shared';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateMessage';
import { useProjectCrumbs } from '@/features/projects/use-project-crumbs';
import { cn } from '@/lib/utils';
import { useCalendar } from '../hooks';

const EVENT_STYLE: Record<CalendarEventType, { label: string; tone: BadgeTone; tile: string }> = {
  SPRINT: {
    label: 'Sprint',
    tone: 'success',
    tile: 'bg-green-50 text-success dark:bg-green-950/40',
  },
  MILESTONE: {
    label: 'Jalon',
    tone: 'purple',
    tile: 'bg-purple-50 text-purple dark:bg-purple-950/40 dark:text-purple-300',
  },
  WORK_ITEM: { label: 'Epic', tone: 'accent', tile: 'bg-accent-50 text-accent-600' },
};

export function CalendarPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const crumbs = useProjectCrumbs(projectKey, 'Calendrier');
  const { data, isLoading, error } = useCalendar(projectKey);
  const groups = useMemo(() => groupByMonth(data ?? []), [data]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  const count = data?.length ?? 0;

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="flex flex-col gap-4 px-4 pt-5 pb-6 sm:px-6">
        <PageHeader
          title="Calendrier"
          breadcrumbs={crumbs}
          count={`${count} événement${count > 1 ? 's' : ''}`}
        />

        {!data || data.length === 0 ? (
          <div className="card">
            <EmptyState title="Calendrier vide" />
          </div>
        ) : (
          <div className="flex max-w-4xl flex-col gap-5">
            {groups.map((group) => (
              <section key={group.month}>
                <h2 className="text-ink-900 mb-2 text-lg font-semibold first-letter:uppercase">
                  {group.month}
                </h2>
                <div className="card overflow-hidden">
                  {group.events.map((event) => (
                    <div
                      key={`${event.type}-${event.id}`}
                      className="border-border-subtle hover:bg-surface-muted grid grid-cols-[80px_36px_1fr_auto] items-center gap-3 border-b px-4 py-2.5 last:border-b-0"
                    >
                      <span className="text-ink-500 text-sm first-letter:uppercase">
                        {formatDay(event.start)}
                      </span>
                      <EventIcon event={event} />
                      <span className="text-ink-900 truncate text-base font-medium">
                        {event.title}
                      </span>
                      <Badge tone={EVENT_STYLE[event.type].tone}>
                        {EVENT_STYLE[event.type].label}
                      </Badge>
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
  return (
    <span
      className={cn(
        'flex size-8 items-center justify-center rounded-lg',
        EVENT_STYLE[event.type].tile,
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </span>
  );
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
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', weekday: 'short' }).format(
    new Date(value),
  );
}
