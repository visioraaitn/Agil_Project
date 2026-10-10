import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  LABELS_FR,
  WorkItemStatus,
  WorkItemType,
  type BacklogNode,
  type WorkItemFilters,
} from '@visiora/shared';
import { LoadingState } from '@/components/common/StateMessage';
import { defaultSprintId, useSprints } from '@/features/sprints/hooks';
import { TypeIcon } from '@/features/work-items/components/WorkItemChrome';
import { useBacklog, useBoard } from '@/features/work-items/hooks';
import { STATUS_DOT } from '@/features/work-items/status-colors';
import { cn } from '@/lib/utils';

const ALL_PROJECT = '';

/** Libellés pluriels des types, dans l'ordre de la hiérarchie. */
const TYPE_ORDER: { type: WorkItemType; label: string }[] = [
  { type: WorkItemType.EPIC, label: 'Epics' },
  { type: WorkItemType.STORY, label: 'User Stories' },
  { type: WorkItemType.BUG, label: 'Bugs' },
  { type: WorkItemType.SUBTASK, label: 'Sous-tâches' },
];

function flatten(nodes: BacklogNode[]): BacklogNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/**
 * B.1 · Statistiques du board dans la vue d'ensemble, pour un sprint ou tout le
 * projet. Les types viennent de l'arbre du backlog (Epics compris) ; la
 * répartition par colonne vient du board lui-même, colonnes personnalisées
 * comprises, avec la même règle « une carte = une colonne » que le Task Board.
 */
export function BoardStatsPanel({ projectKey }: { projectKey: string }) {
  const { data: sprints } = useSprints(projectKey);
  const [sprintId, setSprintId] = useState<string | null>(null);

  // Par défaut : le sprint actif, comme le Task Board.
  useEffect(() => {
    if (sprintId !== null) return;
    const fallback = defaultSprintId(sprints);
    if (fallback) setSprintId(fallback);
    else if (sprints) setSprintId(ALL_PROJECT);
  }, [sprintId, sprints]);

  const scope = sprintId ?? ALL_PROJECT;
  const boardFilters = useMemo<WorkItemFilters>(() => (scope ? { sprintId: scope } : {}), [scope]);
  const { data: columns, isLoading: boardLoading } = useBoard(
    projectKey,
    boardFilters,
    sprintId !== null,
  );
  const { data: tree, isLoading: treeLoading } = useBacklog(projectKey, {});

  const stats = useMemo(() => {
    // Un Epic compte pour un sprint dès qu'il y est lui-même ou qu'une partie de sa
    // descendance y travaille — c'est ce que montre le Task Board de ce sprint.
    const inScope = (node: BacklogNode): boolean =>
      !scope ||
      node.sprintId === scope ||
      (node.type === WorkItemType.EPIC &&
        flatten(node.children).some((child) => child.sprintId === scope));
    const items = flatten(tree ?? []).filter(inScope);
    const byType = new Map(
      TYPE_ORDER.map(({ type }) => [type, items.filter((item) => item.type === type).length]),
    );
    const boardItems = (columns ?? []).flatMap((column) => column.items);
    const done = boardItems.filter((item) => item.status === WorkItemStatus.DONE).length;
    return {
      total: items.length,
      byType,
      boardTotal: boardItems.length,
      done,
      completion: boardItems.length > 0 ? (done / boardItems.length) * 100 : 0,
    };
  }, [tree, columns, scope]);

  const loading = sprintId === null || boardLoading || treeLoading;

  return (
    <section className="card px-5 py-4">
      <header className="flex flex-wrap items-center gap-3">
        <BarChart3 className="text-ink-600 size-[18px]" strokeWidth={1.75} />
        <h2 className="text-ink-900 text-lg font-semibold">Statistiques du board</h2>
        <label className="ml-auto flex items-center gap-2">
          <span className="text-ink-600 text-sm font-semibold">Sprint</span>
          <select
            value={scope}
            onChange={(event) => setSprintId(event.target.value)}
            className={cn('filter-select max-w-64', scope && 'is-active')}
          >
            <option value={ALL_PROJECT}>Tout le projet</option>
            {(sprints ?? []).map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name} · {LABELS_FR.sprintStatus[sprint.status]}
              </option>
            ))}
          </select>
        </label>
      </header>

      {loading ? (
        <LoadingState label="Calcul des statistiques…" />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Total work items" value={stats.total} emphasis />
            {TYPE_ORDER.map(({ type, label }) => (
              <StatTile
                key={type}
                label={label}
                value={stats.byType.get(type) ?? 0}
                icon={<TypeIcon type={type} boxed={type === WorkItemType.EPIC} />}
              />
            ))}
            <div className="bg-accent-50 rounded-xl px-3.5 py-3">
              <p className="text-accent-700 text-xs font-semibold">Complétion des sous-tâches</p>
              <p className="text-accent-700 mt-1 text-2xl font-bold tabular-nums">
                {stats.completion.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %
              </p>
              <span className="bg-accent-100 mt-1.5 block h-1.5 overflow-hidden rounded-full">
                <span
                  className="bg-accent-500 block h-full rounded-full"
                  style={{ width: `${Math.min(100, stats.completion)}%` }}
                />
              </span>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-ink-900 text-sm font-semibold">
                Sous-tâches par colonne du board
              </h3>
              <span className="text-ink-500 text-xs">
                {stats.boardTotal} sous-tâche{stats.boardTotal > 1 ? 's' : ''} sur le board ·{' '}
                {stats.done} terminée{stats.done > 1 ? 's' : ''}
              </span>
            </div>

            {stats.boardTotal > 0 && (
              <div className="bg-surface-sunken mb-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
                {(columns ?? [])
                  .filter((column) => column.count > 0)
                  .map((column) => (
                    <span
                      key={column.id}
                      className={cn('h-full', STATUS_DOT[column.status])}
                      style={{ flexGrow: column.count }}
                      title={`${column.name} : ${column.count}`}
                    />
                  ))}
              </div>
            )}

            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {(columns ?? []).map((column) => (
                <li
                  key={column.id}
                  className="border-border-default flex items-center gap-2 rounded-lg border px-3 py-2"
                >
                  <span className={cn('size-2 shrink-0 rounded-full', STATUS_DOT[column.status])} />
                  <span
                    className="text-ink-700 min-w-0 flex-1 truncate text-sm"
                    title={column.name}
                  >
                    {column.name}
                    {!column.isVisible && <span className="text-ink-400"> (masquée)</span>}
                  </span>
                  <span className="text-ink-900 text-base font-semibold tabular-nums">
                    {column.count}
                  </span>
                  <span className="text-ink-500 w-11 text-right text-xs tabular-nums">
                    {stats.boardTotal > 0
                      ? `${Math.round((column.count / stats.boardTotal) * 100)} %`
                      : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

function StatTile({
  label,
  value,
  icon,
  emphasis = false,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl px-3.5 py-3',
        emphasis ? 'bg-surface-sunken' : 'border-border-default border',
      )}
    >
      <p className="text-ink-500 flex items-center gap-1.5 text-xs font-semibold">
        {icon}
        {label}
      </p>
      <p className="text-ink-900 mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
