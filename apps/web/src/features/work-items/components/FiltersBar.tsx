import { Search, X } from 'lucide-react';
import {
  LABELS_FR,
  Priority,
  SortOrder,
  WorkItemSortBy,
  WorkItemType,
  type UserDirectoryEntry,
  type WorkItemFilters,
} from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { useLabels, useTags } from '../hooks';

interface FiltersBarProps {
  projectRef: string;
  filters: WorkItemFilters;
  onChange: (filters: WorkItemFilters) => void;
  members: UserDirectoryEntry[];
  /** Le backlog propose « masquer les terminés », pas le board. */
  showHideDone?: boolean;
}

/** F.4 · Filtres avancés — communs au backlog et au board. */
export function FiltersBar({
  projectRef,
  filters,
  onChange,
  members,
  showHideDone = false,
}: FiltersBarProps) {
  const { data: labels } = useLabels(projectRef);
  const { data: tags } = useTags(projectRef);

  const set = <K extends keyof WorkItemFilters>(key: K, value: WorkItemFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const hasFilters = Object.entries(filters).some(
    ([key, value]) => key !== 'hideDone' && value !== undefined && value !== '',
  );

  return (
    <div className="border-border-subtle flex flex-wrap items-center gap-1.5 border-b px-4 py-1.5">
      <div className="border-border-strong bg-surface focus-within:border-accent-500 flex h-6.5 w-52 items-center gap-1.5 rounded border px-2">
        <Search className="text-ink-400 size-3.5 shrink-0" strokeWidth={2} />
        <input
          value={filters.search ?? ''}
          onChange={(event) => set('search', event.target.value || undefined)}
          placeholder="Rechercher…"
          aria-label="Rechercher un ticket"
          className="text-ink-700 placeholder:text-ink-400 w-full bg-transparent text-sm outline-none"
        />
      </div>

      <Select
        aria-label="Filtrer par type"
        className="h-6.5 w-32 text-sm"
        value={filters.type ?? ''}
        onChange={(event) => set('type', (event.target.value || undefined) as WorkItemType)}
      >
        <option value="">Tous les types</option>
        {Object.values(WorkItemType).map((type) => (
          <option key={type} value={type}>
            {LABELS_FR.workItemType[type]}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filtrer par assigné"
        className="h-6.5 w-40 text-sm"
        value={filters.assigneeId ?? ''}
        onChange={(event) => set('assigneeId', event.target.value || undefined)}
      >
        <option value="">Tous les assignés</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filtrer par créateur"
        className="h-6.5 w-40 text-sm"
        value={filters.creatorId ?? ''}
        onChange={(event) => set('creatorId', event.target.value || undefined)}
      >
        <option value="">Tous les créateurs</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filtrer par priorité"
        className="h-6.5 w-32 text-sm"
        value={filters.priority ?? ''}
        onChange={(event) => set('priority', (event.target.value || undefined) as Priority)}
      >
        <option value="">Toutes priorités</option>
        {Object.values(Priority).map((priority) => (
          <option key={priority} value={priority}>
            {LABELS_FR.priority[priority]}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filtrer par tag"
        className="h-6.5 w-36 text-sm"
        value={filters.tagId ?? ''}
        onChange={(event) => set('tagId', event.target.value || undefined)}
      >
        <option value="">Tous les tags</option>
        {(tags ?? []).map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Filtrer par étiquette"
        className="h-6.5 w-36 text-sm"
        value={filters.labelId ?? ''}
        onChange={(event) => set('labelId', event.target.value || undefined)}
      >
        <option value="">Toutes les étiquettes</option>
        {(labels ?? []).map((label) => (
          <option key={label.id} value={label.id}>
            {label.name}
          </option>
        ))}
      </Select>

      <Select
        aria-label="Trier les tickets"
        className="h-6.5 w-36 text-sm"
        value={filters.sortBy ?? ''}
        onChange={(event) =>
          set('sortBy', (event.target.value || undefined) as WorkItemFilters['sortBy'])
        }
      >
        <option value="">Ordre manuel</option>
        <option value={WorkItemSortBy.KEY}>Identifiant</option>
        <option value={WorkItemSortBy.TITLE}>Titre</option>
        <option value={WorkItemSortBy.STATUS}>Statut</option>
        <option value={WorkItemSortBy.PRIORITY}>Priorité</option>
        <option value={WorkItemSortBy.CREATED_AT}>Date de création</option>
        <option value={WorkItemSortBy.UPDATED_AT}>Dernière modification</option>
        <option value={WorkItemSortBy.DUE_DATE}>Échéance</option>
      </Select>

      {filters.sortBy && (
        <Select
          aria-label="Sens du tri"
          className="h-6.5 w-28 text-sm"
          value={filters.sortOrder ?? SortOrder.ASC}
          onChange={(event) => set('sortOrder', event.target.value as WorkItemFilters['sortOrder'])}
        >
          <option value={SortOrder.ASC}>Croissant</option>
          <option value={SortOrder.DESC}>Décroissant</option>
        </Select>
      )}

      {showHideDone && (
        <label className="text-ink-700 flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={filters.hideDone ?? false}
            onChange={(event) => set('hideDone', event.target.checked || undefined)}
            className="size-3.5"
          />
          Masquer les terminés
        </label>
      )}

      {hasFilters && (
        <Button size="sm" variant="ghost" onClick={() => onChange({ hideDone: filters.hideDone })}>
          <X className="size-3.5" strokeWidth={2} />
          Réinitialiser
        </Button>
      )}
    </div>
  );
}
