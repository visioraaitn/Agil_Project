import type { ReactNode } from 'react';
import { ListFilter, Search, X } from 'lucide-react';
import {
  LABELS_FR,
  Priority,
  SortOrder,
  WorkItemSortBy,
  WorkItemType,
  type UserDirectoryEntry,
  type WorkItemFilters,
} from '@visiora/shared';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLabels, useTags } from '../hooks';

interface FiltersBarProps {
  projectRef: string;
  filters: WorkItemFilters;
  onChange: (filters: WorkItemFilters) => void;
  members: UserDirectoryEntry[];
  /** Le backlog propose « masquer les terminés », pas le board. */
  showHideDone?: boolean;
  /** Le board propose le filtre rapide par avatar d'assigné. */
  showMemberQuickFilter?: boolean;
  /** Le Task Board ne montre que des sous-tâches : le filtre de type n'y a pas de sens. */
  showTypeFilter?: boolean;
  className?: string;
}

/** Liste déroulante en pilule pointillée ; passe en bleu quand un filtre est actif. */
function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      // Sur grand écran, les listes se partagent la largeur restante : tout tient sur une ligne.
      className={cn('filter-select max-w-44 min-w-24 lg:flex-1 lg:basis-0', value && 'is-active')}
    >
      {children}
    </select>
  );
}

/** F.4 · Filtres avancés — communs au backlog et au board. */
export function FiltersBar({
  projectRef,
  filters,
  onChange,
  members,
  showHideDone = false,
  showMemberQuickFilter = false,
  showTypeFilter = true,
  className,
}: FiltersBarProps) {
  const { data: labels } = useLabels(projectRef);
  const { data: tags } = useTags(projectRef);

  const set = <K extends keyof WorkItemFilters>(key: K, value: WorkItemFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const hasFilters = Object.entries(filters).some(
    ([key, value]) => key !== 'hideDone' && value !== undefined && value !== '',
  );

  return (
    <div
      className={cn(
        'card flex flex-wrap items-center gap-1.5 px-2 py-1.5 lg:flex-nowrap',
        className,
      )}
    >
      <div className="relative w-full shrink-0 sm:w-44 lg:w-40 xl:w-48">
        <Search
          className="text-ink-400 pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
          strokeWidth={2}
        />
        <input
          value={filters.search ?? ''}
          onChange={(event) => set('search', event.target.value || undefined)}
          placeholder="Rechercher…"
          aria-label="Rechercher un ticket"
          className="search-field"
        />
      </div>

      <span className="bg-border-default mx-0.5 hidden h-6 w-px sm:block" aria-hidden="true" />

      {showTypeFilter && (
        <FilterSelect
          label="Filtrer par type"
          value={filters.type ?? ''}
          onChange={(value) => set('type', (value || undefined) as WorkItemType)}
        >
          <option value="">Types</option>
          {Object.values(WorkItemType).map((type) => (
            <option key={type} value={type}>
              {LABELS_FR.workItemType[type]}
            </option>
          ))}
        </FilterSelect>
      )}

      <FilterSelect
        label="Filtrer par assigné"
        value={filters.assigneeId ?? ''}
        onChange={(value) => set('assigneeId', value || undefined)}
      >
        <option value="">Assignés</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Filtrer par créateur"
        value={filters.creatorId ?? ''}
        onChange={(value) => set('creatorId', value || undefined)}
      >
        <option value="">Créateurs</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Filtrer par priorité"
        value={filters.priority ?? ''}
        onChange={(value) => set('priority', (value || undefined) as Priority)}
      >
        <option value="">Priorités</option>
        {Object.values(Priority).map((priority) => (
          <option key={priority} value={priority}>
            {LABELS_FR.priority[priority]}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Filtrer par tag"
        value={filters.tagId ?? ''}
        onChange={(value) => set('tagId', value || undefined)}
      >
        <option value="">Tags</option>
        {(tags ?? []).map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.name}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Filtrer par étiquette"
        value={filters.labelId ?? ''}
        onChange={(value) => set('labelId', value || undefined)}
      >
        <option value="">Étiquettes</option>
        {(labels ?? []).map((label) => (
          <option key={label.id} value={label.id}>
            {label.name}
          </option>
        ))}
      </FilterSelect>

      {hasFilters && (
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0"
          onClick={() => onChange({ hideDone: filters.hideDone })}
        >
          <X strokeWidth={2} />
          Réinitialiser
        </Button>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {showMemberQuickFilter && members.length > 0 && (
          <div
            className="flex items-center -space-x-1.5"
            role="group"
            aria-label="Filtre rapide par assigné"
          >
            {members.map((member) => {
              const active = filters.assigneeId === member.id;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => set('assigneeId', active ? undefined : member.id)}
                  aria-pressed={active}
                  title={member.name}
                  className={cn(
                    'ring-surface relative rounded-full ring-2 transition-transform hover:z-10 hover:-translate-y-0.5',
                    active && 'ring-accent-500 z-10',
                    filters.assigneeId && !active && 'opacity-45',
                  )}
                >
                  <Avatar
                    name={member.name}
                    avatarUrl={member.avatarUrl}
                    size="md"
                    className="size-6"
                  />
                </button>
              );
            })}
          </div>
        )}

        <div className="relative">
          <ListFilter
            className="text-ink-500 pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            strokeWidth={2}
          />
          <select
            aria-label="Trier les tickets"
            value={filters.sortBy ?? ''}
            onChange={(event) =>
              set('sortBy', (event.target.value || undefined) as WorkItemFilters['sortBy'])
            }
            className="bg-surface-sunken text-ink-700 hover:bg-border-subtle h-8 cursor-pointer appearance-none rounded-lg border border-transparent pr-3 pl-7.5 text-sm font-medium focus:border-accent-500 focus:outline-none"
          >
            <option value="">Ordre manuel</option>
            <option value={WorkItemSortBy.KEY}>Identifiant</option>
            <option value={WorkItemSortBy.TITLE}>Titre</option>
            <option value={WorkItemSortBy.STATUS}>Statut</option>
            <option value={WorkItemSortBy.PRIORITY}>Priorité</option>
            <option value={WorkItemSortBy.CREATED_AT}>Date de création</option>
            <option value={WorkItemSortBy.UPDATED_AT}>Dernière modification</option>
            <option value={WorkItemSortBy.DUE_DATE}>Échéance</option>
          </select>
        </div>

        {filters.sortBy && (
          <FilterSelect
            label="Sens du tri"
            value={filters.sortOrder ?? SortOrder.ASC}
            onChange={(value) => set('sortOrder', value as WorkItemFilters['sortOrder'])}
          >
            <option value={SortOrder.ASC}>Croissant</option>
            <option value={SortOrder.DESC}>Décroissant</option>
          </FilterSelect>
        )}

        {showHideDone && (
          <Toggle
            checked={filters.hideDone ?? false}
            onChange={(checked) => set('hideDone', checked || undefined)}
            label="Masquer les terminés"
          />
        )}
      </div>
    </div>
  );
}

/** Interrupteur compact (remplace la case à cocher). */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="text-ink-700 flex cursor-pointer items-center gap-2 text-sm font-medium whitespace-nowrap select-none">
      <span className="relative h-[18px] w-8 shrink-0">
        {/* Case réelle posée (invisible) sur l'interrupteur : cliquable et lisible par les lecteurs d'écran. */}
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
        />
        <span
          aria-hidden="true"
          className={cn(
            'peer-focus-visible:outline-accent-500 absolute inset-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
            checked ? 'bg-accent-500' : 'bg-border-strong',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform',
              checked && 'translate-x-3.5',
            )}
          />
        </span>
      </span>
      {label}
    </label>
  );
}
