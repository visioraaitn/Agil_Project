import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  LABELS_FR,
  Priority,
  STORY_POINT_SCALE,
  WorkItemStatus,
  WorkItemType,
  type AcceptanceCriterionInput,
  type UpdateWorkItemInput,
  type WorkItemDetail,
} from '@visiora/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Avatar } from '@/components/common/Avatar';
import { ErrorState, InlineError, LoadingState } from '@/components/common/StateMessage';
import { AttachmentsPanel } from '@/features/collaboration/components/AttachmentsPanel';
import { CommentsPanel } from '@/features/collaboration/components/CommentsPanel';
import { useProjectMembers, useProjectPermissions } from '@/features/projects/hooks';
import { AcceptanceCriteriaEditor } from './AcceptanceCriteriaEditor';
import { StatusPill, TypeIcon } from './WorkItemChrome';
import { useCreateWorkItem, useDeleteWorkItem, useLabels, useUpdateWorkItem, useWorkItem } from '../hooks';

interface WorkItemDetailPanelProps {
  projectRef: string;
  itemId: string | null;
  onClose: () => void;
}

/** D.2 · Détails de la user story · D.3 · Sous-tâches. */
export function WorkItemDetailPanel({ projectRef, itemId, onClose }: WorkItemDetailPanelProps) {
  const { data: item, isLoading, error } = useWorkItem(projectRef, itemId);

  useEffect(() => {
    if (!itemId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [itemId, onClose]);

  if (!itemId) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/20"
      role="dialog"
      aria-modal="true"
      aria-label="Détail du ticket"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border-border-default flex h-full w-full max-w-2xl flex-col border-l shadow-xl">
        {isLoading && <LoadingState />}
        {error && <ErrorState error={error} />}
        {item && <DetailBody projectRef={projectRef} item={item} onClose={onClose} />}
      </div>
    </div>
  );
}

function DetailBody({
  projectRef,
  item,
  onClose,
}: {
  projectRef: string;
  item: WorkItemDetail;
  onClose: () => void;
}) {
  const { can } = useProjectPermissions(projectRef);
  const { data: members } = useProjectMembers(projectRef);
  const { data: labels } = useLabels(projectRef);
  const update = useUpdateWorkItem(projectRef);
  const remove = useDeleteWorkItem(projectRef);
  const createChild = useCreateWorkItem(projectRef);

  const canEdit = can('workitem:update');
  const canDelete = can('workitem:delete');
  const canComment = can('comment:create');
  const canManageAttachments = can('attachment:manage');

  const [draft, setDraft] = useState(() => toDraft(item));
  const [criteria, setCriteria] = useState<AcceptanceCriterionInput[]>(item.acceptanceCriteria);
  const [labelIds, setLabelIds] = useState<string[]>(item.labels.map((label) => label.id));
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [saveError, setSaveError] = useState<unknown>(null);

  // Le panneau reste monté d'un ticket à l'autre : on resynchronise le brouillon.
  useEffect(() => {
    setDraft(toDraft(item));
    setCriteria(item.acceptanceCriteria);
    setLabelIds(item.labels.map((label) => label.id));
    setSaveError(null);
  }, [item]);

  const save = async () => {
    setSaveError(null);
    const payload: UpdateWorkItemInput = {
      title: draft.title,
      description: draft.description || null,
      technicalNotes: draft.technicalNotes || null,
      status: draft.status,
      priority: draft.priority,
      storyPoints: draft.storyPoints === '' ? null : Number(draft.storyPoints),
      assigneeId: draft.assigneeId || null,
      isBlocked: draft.isBlocked,
      blockedReason: draft.isBlocked ? draft.blockedReason || null : null,
      labelIds,
      acceptanceCriteria: criteria,
    };

    try {
      await update.mutateAsync({ itemId: item.id, input: payload });
    } catch (error) {
      setSaveError(error);
    }
  };

  const addSubtask = async () => {
    const title = subtaskTitle.trim();
    if (!title) return;
    setSaveError(null);
    try {
      await createChild.mutateAsync({
        type: WorkItemType.SUBTASK,
        title,
        parentId: item.id,
        priority: Priority.MEDIUM,
      });
      setSubtaskTitle('');
    } catch (error) {
      setSaveError(error);
    }
  };

  const destroy = async () => {
    if (!window.confirm(`Supprimer ${item.key} et ses sous-tâches ?`)) return;
    try {
      await remove.mutateAsync(item.id);
      onClose();
    } catch (error) {
      setSaveError(error);
    }
  };

  const canHaveSubtasks = item.type === WorkItemType.STORY || item.type === WorkItemType.BUG;

  return (
    <>
      <header className="border-border-subtle flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <TypeIcon type={item.type} />
        <span className="text-ink-400 text-sm font-semibold">{item.key}</span>
        <StatusPill status={item.status} />
        {item.parent && (
          <span className="text-ink-400 truncate text-sm">
            dans {item.parent.key} · {item.parent.title}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {canDelete && (
            <Button size="sm" variant="ghost" aria-label="Supprimer le ticket" onClick={destroy}>
              <Trash2 className="text-danger size-3.5" strokeWidth={1.75} />
            </Button>
          )}
          <Button size="sm" variant="ghost" aria-label="Fermer" onClick={onClose}>
            <X className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
      </header>

      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3">
        <Field label="Titre" htmlFor="wi-title">
          <Input
            id="wi-title"
            value={draft.title}
            disabled={!canEdit}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Statut" htmlFor="wi-status">
            <Select
              id="wi-status"
              value={draft.status}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft({ ...draft, status: event.target.value as WorkItemStatus })
              }
            >
              {Object.values(WorkItemStatus).map((status) => (
                <option key={status} value={status}>
                  {LABELS_FR.workItemStatus[status]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Priorité" htmlFor="wi-priority">
            <Select
              id="wi-priority"
              value={draft.priority}
              disabled={!canEdit}
              onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}
            >
              {Object.values(Priority).map((priority) => (
                <option key={priority} value={priority}>
                  {LABELS_FR.priority[priority]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Assigné" htmlFor="wi-assignee">
            <Select
              id="wi-assignee"
              value={draft.assigneeId}
              disabled={!canEdit}
              onChange={(event) => setDraft({ ...draft, assigneeId: event.target.value })}
            >
              <option value="">Non assigné</option>
              {(members ?? []).map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Story points"
            htmlFor="wi-points"
            hint={item.type === WorkItemType.EPIC ? `Total descendants : ${item.rolledUpPoints}` : undefined}
          >
            <Select
              id="wi-points"
              value={draft.storyPoints}
              disabled={!canEdit}
              onChange={(event) => setDraft({ ...draft, storyPoints: event.target.value })}
            >
              <option value="">Non estimé</option>
              {STORY_POINT_SCALE.map((points) => (
                <option key={points} value={points}>
                  {points}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Description — contexte métier (Product Owner)" htmlFor="wi-description">
          <Textarea
            id="wi-description"
            rows={5}
            value={draft.description}
            disabled={!canEdit}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </Field>

        <Field label="Notes techniques d'implémentation (développeur)" htmlFor="wi-notes">
          <Textarea
            id="wi-notes"
            rows={4}
            value={draft.technicalNotes}
            disabled={!canEdit}
            onChange={(event) => setDraft({ ...draft, technicalNotes: event.target.value })}
          />
        </Field>

        <AcceptanceCriteriaEditor criteria={criteria} onChange={setCriteria} readOnly={!canEdit} />

        <section>
          <h3 className="text-ink-700 mb-1 text-sm font-semibold">Étiquettes</h3>
          <div className="flex flex-wrap gap-1">
            {(labels ?? []).map((label) => {
              const selected = labelIds.includes(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    setLabelIds(
                      selected
                        ? labelIds.filter((id) => id !== label.id)
                        : [...labelIds, label.id],
                    )
                  }
                  className={`rounded px-1.5 py-0.5 text-xs font-semibold transition-opacity ${
                    selected ? 'text-white' : 'text-ink-500 bg-surface-sunken opacity-70'
                  }`}
                  style={selected ? { backgroundColor: label.color } : undefined}
                >
                  {label.name}
                </button>
              );
            })}
            {(labels ?? []).length === 0 && (
              <p className="text-ink-400 text-sm">Aucune étiquette définie sur ce projet.</p>
            )}
          </div>
        </section>

        <section>
          <label className="text-ink-700 flex items-center gap-2 text-base">
            <input
              type="checkbox"
              checked={draft.isBlocked}
              disabled={!canEdit}
              onChange={(event) => setDraft({ ...draft, isBlocked: event.target.checked })}
              className="size-3.5"
            />
            Ticket bloqué
          </label>
          {draft.isBlocked && (
            <Input
              value={draft.blockedReason}
              disabled={!canEdit}
              placeholder="Motif du blocage"
              aria-label="Motif du blocage"
              className="mt-1"
              onChange={(event) => setDraft({ ...draft, blockedReason: event.target.value })}
            />
          )}
        </section>

        {canHaveSubtasks && (
          <section>
            <h3 className="text-ink-700 mb-1 text-sm font-semibold">
              Sous-tâches{' '}
              {item.childCount > 0 && (
                <span className="text-ink-400 font-normal">
                  {item.doneChildCount}/{item.childCount}
                </span>
              )}
            </h3>

            <ul className="divide-border-subtle divide-y">
              {item.children.map((child) => (
                <li key={child.id} className="flex items-center gap-2 py-1">
                  <TypeIcon type={child.type} />
                  <span className="text-ink-400 text-xs">{child.key}</span>
                  <span
                    className={`flex-1 truncate text-base ${
                      child.status === WorkItemStatus.DONE ? 'text-ink-400 line-through' : ''
                    }`}
                  >
                    {child.title}
                  </span>
                  <StatusPill status={child.status} />
                  {child.assignee && (
                    <Avatar name={child.assignee.name} avatarUrl={child.assignee.avatarUrl} />
                  )}
                </li>
              ))}
            </ul>

            {item.children.length === 0 && (
              <p className="text-ink-400 text-sm">Aucune sous-tâche.</p>
            )}

            {can('workitem:create') && (
              <div className="mt-1.5 flex gap-1.5">
                <Input
                  value={subtaskTitle}
                  onChange={(event) => setSubtaskTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void addSubtask();
                    }
                  }}
                  placeholder="Ajouter une sous-tâche…"
                  aria-label="Titre de la sous-tâche"
                  className="h-6.5 text-sm"
                />
                <Button
                  size="sm"
                  onClick={addSubtask}
                  loading={createChild.isPending}
                  disabled={subtaskTitle.trim().length < 3}
                >
                  <Plus className="size-3.5" strokeWidth={2.5} />
                </Button>
              </div>
            )}
          </section>
        )}

        <CommentsPanel
          projectRef={projectRef}
          itemId={item.id}
          members={(members ?? []).map((member) => member.user)}
          canComment={canComment}
        />

        <AttachmentsPanel
          projectRef={projectRef}
          itemId={item.id}
          canManage={canManageAttachments}
        />
      </div>

      <footer className="border-border-subtle flex shrink-0 items-center gap-2 border-t px-3 py-2">
        {saveError ? <InlineError error={saveError} /> : <Badge>{LABELS_FR.workItemType[item.type]}</Badge>}
        <div className="ml-auto flex gap-2">
          <Button onClick={onClose}>Fermer</Button>
          {canEdit && (
            <Button variant="primary" onClick={save} loading={update.isPending}>
              Enregistrer
            </Button>
          )}
        </div>
      </footer>
    </>
  );
}

function toDraft(item: WorkItemDetail) {
  return {
    title: item.title,
    description: item.description ?? '',
    technicalNotes: item.technicalNotes ?? '',
    status: item.status,
    priority: item.priority,
    storyPoints: item.storyPoints === null ? '' : String(item.storyPoints),
    assigneeId: item.assignee?.id ?? '',
    isBlocked: item.isBlocked,
    blockedReason: item.blockedReason ?? '',
  };
}
