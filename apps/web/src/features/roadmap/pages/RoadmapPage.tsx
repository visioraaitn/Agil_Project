import { useParams } from 'react-router-dom';
import { CalendarRange } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateMessage';
import { useRoadmap } from '@/features/sprints/hooks';
import { StatusPill, StoryPoints } from '@/features/work-items/components/WorkItemChrome';

export function RoadmapPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const { data: epics, isLoading, error } = useRoadmap(projectKey);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="flex h-full flex-col">
      <header className="border-border-subtle flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <h1 className="text-ink-900 text-xl font-semibold">Roadmap</h1>
        <span className="text-ink-400 text-sm">{epics?.length ?? 0} epic(s)</span>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-4">
        {!epics || epics.length === 0 ? (
          <EmptyState title="Roadmap vide" description="Ajoutez des dates aux epics du backlog." />
        ) : (
          <div className="relative max-w-5xl">
            <div className="bg-border-default absolute bottom-0 left-4 top-0 w-px" />
            <div className="flex flex-col gap-3">
              {epics.map((epic) => (
                <article key={epic.id} className="relative pl-10">
                  <span className="bg-accent-500 absolute left-[11px] top-4 size-3 rounded-full" />
                  <div className="border-border-default rounded border bg-surface px-3 py-2">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-ink-400 text-xs font-semibold">{epic.key}</p>
                        <h2 className="text-ink-900 truncate text-lg font-semibold">{epic.title}</h2>
                      </div>
                      <StatusPill status={epic.status} />
                      <StoryPoints points={epic.rolledUpPoints || null} />
                    </div>
                    <div className="text-ink-500 mt-2 flex items-center gap-2 text-sm">
                      <CalendarRange className="size-3.5" strokeWidth={1.75} />
                      {formatDate(epic.startDate)} - {formatDate(epic.dueDate)}
                      <span className="ml-auto">
                        {epic.doneChildCount}/{epic.childCount} elements termines
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return 'Non planifie';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(value),
  );
}
