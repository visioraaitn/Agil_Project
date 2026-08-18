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
} from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/common/StateMessage';
import { useProjectMembers } from '@/features/projects/hooks';
import { useCreateWorkItem } from '../hooks';

interface CreateWorkItemDialogProps {
  open: boolean;
  onClose: () => void;
  projectRef: string;
  /** Tickets pouvant servir de parent, à plat. */
  candidates: BacklogNode[];
  /** Type et parent présélectionnés (création depuis une ligne du backlog). */
  defaultType?: WorkItemType;
  defaultParentId?: string | null;
}

export function CreateWorkItemDialog({
  open,
  onClose,
  projectRef,
  candidates,
  defaultType = WorkItemType.STORY,
  defaultParentId = null,
}: CreateWorkItemDialogProps) {
  const createItem = useCreateWorkItem(projectRef);
  const { data: members } = useProjectMembers(projectRef);
  const [form, setForm] = useState(() => emptyForm(defaultType, defaultParentId));
  const [submitError, setSubmitError] = useState<unknown>(null);

  useEffect(() => {
    if (open) {
      setForm(emptyForm(defaultType, defaultParentId));
      setSubmitError(null);
    }
  }, [open, defaultType, defaultParentId]);

  const allowedParents = ALLOWED_PARENT_TYPES[form.type];
  const parentOptions = flatten(candidates).filter((node) => allowedParents.includes(node.type));
  const parentRequired = REQUIRES_PARENT.includes(form.type);

  const submit = async () => {
    setSubmitError(null);
    const input: CreateWorkItemInput = {
      type: form.type,
      title: form.title.trim(),
      parentId: form.parentId || null,
      description: form.description || null,
      priority: form.priority,
      storyPoints: form.storyPoints === '' ? null : Number(form.storyPoints),
      assigneeId: form.assigneeId || null,
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
      title="Nouveau ticket"
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
              onChange={(event) =>
                // Changer de type peut invalider le parent choisi : on le remet à zéro.
                setForm({ ...form, type: event.target.value as WorkItemType, parentId: '' })
              }
            >
              {Object.values(WorkItemType).map((type) => (
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
                ? 'Une sous-tâche doit appartenir à une user story ou à un bug.'
                : 'Laisser vide pour un ticket de premier niveau.'
            }
          >
            <Select
              id="new-parent"
              value={form.parentId}
              onChange={(event) => setForm({ ...form, parentId: event.target.value })}
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
          <Field label="Assigné" htmlFor="new-assignee">
            <Select
              id="new-assignee"
              value={form.assigneeId}
              onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}
            >
              <option value="">Non assigné</option>
              {(members ?? []).map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.name}
                </option>
              ))}
            </Select>
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
        </div>

        <Field label="Description" htmlFor="new-description">
          <Textarea
            id="new-description"
            rows={3}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
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
  priority: Priority;
  storyPoints: string;
  assigneeId: string;
}

function emptyForm(type: WorkItemType, parentId: string | null): WorkItemForm {
  return {
    type,
    title: '',
    parentId: parentId ?? '',
    description: '',
    priority: Priority.MEDIUM,
    storyPoints: '',
    assigneeId: '',
  };
}

/** Aplatit l'arbre pour alimenter le sélecteur de parent. */
function flatten(nodes: BacklogNode[]): BacklogNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}
