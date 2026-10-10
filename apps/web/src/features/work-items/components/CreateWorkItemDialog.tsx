import { useEffect, useState } from 'react';
import {
  ALLOWED_PARENT_TYPES,
  LABELS_FR,
  Priority,
  REQUIRES_PARENT,
  STORY_POINT_SCALE,
  WorkItemType,
  type BacklogNode,
  type CreateWorkItemInput,
  type WorkItemStatus,
} from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/common/StateMessage';
import { useProjectMembers } from '@/features/projects/hooks';
import { useSprints } from '@/features/sprints/hooks';
import { useCreateWorkItem } from '../hooks';
import { AssigneeSelector } from './AssigneeSelector';
import { LabelSection } from './LabelSection';
import { TagSection } from './TagSection';

interface CreateWorkItemDialogProps {
  open: boolean;
  onClose: () => void;
  projectRef: string;
  /** Tickets pouvant servir de parent, à plat. */
  candidates: BacklogNode[];
  /** Type et parent présélectionnés (création depuis une ligne du backlog). */
  defaultType?: WorkItemType;
  defaultParentId?: string | null;
  defaultStatus?: WorkItemStatus;
  defaultSprintId?: string | null;
  /** Types proposés (ex. enfants autorisés sous le parent présélectionné). Tous par défaut. */
  allowedTypes?: readonly WorkItemType[];
}

export function CreateWorkItemDialog({
  open,
  onClose,
  projectRef,
  candidates,
  defaultType = WorkItemType.STORY,
  defaultParentId = null,
  defaultStatus,
  defaultSprintId,
  allowedTypes = Object.values(WorkItemType),
}: CreateWorkItemDialogProps) {
  const createItem = useCreateWorkItem(projectRef);
  const { data: members } = useProjectMembers(projectRef);
  const { data: sprints } = useSprints(projectRef);
  const initialSprintId =
    defaultSprintId !== undefined
      ? defaultSprintId
      : flatten(candidates).find((node) => node.id === defaultParentId)?.sprintId;
  const [form, setForm] = useState(() => emptyForm(defaultType, defaultParentId, defaultSprintId));
  const [submitError, setSubmitError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setForm(emptyForm(defaultType, defaultParentId, initialSprintId));
      setSubmitError(null);
    }
  }, [open, defaultType, defaultParentId, initialSprintId]);

  const allowedParents = ALLOWED_PARENT_TYPES[form.type];
  const parentOptions = flatten(candidates).filter((node) => allowedParents.includes(node.type));
  const parentRequired = REQUIRES_PARENT.includes(form.type);
  const presetParent = flatten(candidates).find((node) => node.id === defaultParentId);

  const submit = async () => {
    setSubmitError(null);
    const input: CreateWorkItemInput = {
      type: form.type,
      title: form.title.trim(),
      parentId: form.parentId || null,
      description: form.description || null,
      technicalNotes: form.technicalNotes || null,
      priority: form.priority,
      storyPoints: form.storyPoints === '' ? null : Number(form.storyPoints),
      assigneeIds: form.assigneeIds,
      status: defaultStatus,
      sprintId: form.sprintId || null,
      tagIds: form.tagIds,
      labelIds: form.labelIds,
    };

    try {
      await createItem.mutateAsync(input);
      onClose();
    } catch (error) {
      setSubmitError(error);
    }
  };

  const invalid = form.title.trim().length < 3 || (parentRequired && !form.parentId);

  return (
    <Modal
      open={open}
      title={presetParent ? `Nouveau ticket sous ${presetParent.key}` : 'Nouveau ticket'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={createItem.isPending}
            disabled={invalid}
          >
            Créer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" htmlFor="new-type" required>
            <Select
              id="new-type"
              value={form.type}
              onChange={(event) => {
                // Changer de type peut invalider le parent choisi : on ne le garde
                // que s'il reste un parent autorisé pour le nouveau type.
                const type = event.target.value as WorkItemType;
                const parent = flatten(candidates).find((node) => node.id === form.parentId);
                setForm({
                  ...form,
                  type,
                  parentId:
                    parent && ALLOWED_PARENT_TYPES[type].includes(parent.type) ? parent.id : '',
                });
              }}
            >
              {allowedTypes.map((type) => (
                <option key={type} value={type}>
                  {LABELS_FR.workItemType[type]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Priorité" htmlFor="new-priority">
            <Select
              id="new-priority"
              value={form.priority}
              onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}
            >
              {Object.values(Priority).map((priority) => (
                <option key={priority} value={priority}>
                  {LABELS_FR.priority[priority]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Titre" htmlFor="new-title" required>
          <Input
            id="new-title"
            autoFocus
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="En tant que… je veux… afin de…"
          />
        </Field>

        {allowedParents.length > 0 && (
          <Field
            label="Rattacher à"
            htmlFor="new-parent"
            required={parentRequired}
            hint={
              parentRequired
                ? 'Une sous-tâche ou un bug appartient à une user story.'
                : 'Laisser vide pour un ticket de premier niveau.'
            }
          >
            <Select
              id="new-parent"
              value={form.parentId}
              onChange={(event) => {
                // Un enfant suit le sprint de son parent (règle appliquée côté API) :
                // on l'affiche d'emblée pour que le formulaire reflète le résultat.
                const parent = parentOptions.find((node) => node.id === event.target.value);
                setForm({
                  ...form,
                  parentId: event.target.value,
                  sprintId: form.sprintId || parent?.sprintId || '',
                });
              }}
            >
              <option value="">Aucun parent</option>
              {parentOptions.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.key} · {node.title}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Personnes assignées" htmlFor="new-assignees">
            <AssigneeSelector
              members={(members ?? []).map((member) => member.user)}
              selectedIds={form.assigneeIds}
              onChange={(assigneeIds) => setForm({ ...form, assigneeIds })}
            />
          </Field>

          <Field label="Story points" htmlFor="new-points">
            <Select
              id="new-points"
              value={form.storyPoints}
              onChange={(event) => setForm({ ...form, storyPoints: event.target.value })}
            >
              <option value="">Non estimé</option>
              {STORY_POINT_SCALE.map((points) => (
                <option key={points} value={points}>
                  {points}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Sprint"
            htmlFor="new-sprint"
            hint={
              form.type === WorkItemType.EPIC
                ? 'Sera propagé à ses User Stories, Bugs et Sous-tâches.'
                : undefined
            }
          >
            <Select
              id="new-sprint"
              value={form.sprintId}
              onChange={(event) => setForm({ ...form, sprintId: event.target.value })}
            >
              <option value="">Backlog (aucun sprint)</option>
              {(sprints ?? []).map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name} · {LABELS_FR.sprintStatus[sprint.status]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <TagSection
          projectRef={projectRef}
          selectedIds={form.tagIds}
          onChange={(tagIds) => setForm({ ...form, tagIds })}
        />

        <LabelSection
          projectRef={projectRef}
          selectedIds={form.labelIds}
          onChange={(labelIds) => setForm({ ...form, labelIds })}
        />

        <Field
          label="Description de cadrage — Product Owner / Project Lead"
          htmlFor="new-description"
        >
          <Textarea
            id="new-description"
            rows={3}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </Field>

        <Field label="Compte rendu des personnes assignées" htmlFor="new-technical-notes">
          <Textarea
            id="new-technical-notes"
            rows={3}
            value={form.technicalNotes}
            onChange={(event) => setForm({ ...form, technicalNotes: event.target.value })}
            placeholder="Analyse, réalisation, décisions techniques et résultat obtenu…"
          />
        </Field>

        <InlineError error={submitError} />
      </div>
    </Modal>
  );
}

interface WorkItemForm {
  type: WorkItemType;
  title: string;
  parentId: string;
  description: string;
  technicalNotes: string;
  priority: Priority;
  storyPoints: string;
  assigneeIds: string[];
  sprintId: string;
  tagIds: string[];
  labelIds: string[];
}

function emptyForm(
  type: WorkItemType,
  parentId: string | null,
  sprintId: string | null | undefined,
): WorkItemForm {
  return {
    type,
    title: '',
    parentId: parentId ?? '',
    description: '',
    technicalNotes: '',
    priority: Priority.MEDIUM,
    storyPoints: '',
    assigneeIds: [],
    sprintId: sprintId ?? '',
    tagIds: [],
    labelIds: [],
  };
}

/** Aplatit l'arbre pour alimenter le sélecteur de parent. */
function flatten(nodes: BacklogNode[]): BacklogNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}
