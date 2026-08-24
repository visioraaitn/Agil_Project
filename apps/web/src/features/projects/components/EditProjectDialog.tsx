import { useEffect, useState } from 'react';
import {
  ProjectStatus,
  updateProjectSchema,
  type ProjectSummary,
  type UpdateProjectInput,
} from '@visiora/shared';
import { InlineError } from '@/components/common/StateMessage';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useUpdateProject } from '../hooks';

interface EditProjectDialogProps {
  project: ProjectSummary;
  projectRef: string;
  open: boolean;
  onClose: () => void;
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: 'Actif',
  ON_HOLD: 'En pause',
  COMPLETED: 'Terminé',
  ARCHIVED: 'Archivé',
};

export function EditProjectDialog({ project, projectRef, open, onClose }: EditProjectDialogProps) {
  const update = useUpdateProject(projectRef);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [color, setColor] = useState('#0078D4');
  const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.ACTIVE);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    setName(project.name);
    setCompany(project.company ?? '');
    setDescription(project.description ?? '');
    setStartDate(project.startDate?.slice(0, 10) ?? '');
    setTargetDate(project.targetDate?.slice(0, 10) ?? '');
    setColor(project.color ?? '#0078D4');
    setStatus(project.status);
    setError(null);
  }, [open, project]);

  const save = async () => {
    setError(null);
    const candidate = {
      name,
      company: company || null,
      description: description || null,
      startDate: startDate || null,
      targetDate: targetDate || null,
      color,
      status,
    };
    const parsed = updateProjectSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(new Error(parsed.error.issues[0]?.message ?? 'Informations invalides'));
      return;
    }

    try {
      await update.mutateAsync(parsed.data as UpdateProjectInput);
      onClose();
    } catch (updateError) {
      setError(updateError);
    }
  };

  return (
    <Modal
      open={open}
      title="Modifier le projet"
      width="md"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={update.isPending} onClick={() => void save()}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Nom" htmlFor="edit-project-name" required>
          <Input
            id="edit-project-name"
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Entreprise" htmlFor="edit-project-company">
            <Input
              id="edit-project-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            />
          </Field>
          <Field label="Statut" htmlFor="edit-project-status">
            <Select
              id="edit-project-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as ProjectStatus)}
            >
              {Object.values(ProjectStatus).map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABEL[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Description" htmlFor="edit-project-description">
          <Textarea
            id="edit-project-description"
            rows={5}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date de début" htmlFor="edit-project-start-date">
            <Input
              id="edit-project-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </Field>
          <Field label="Échéance optionnelle" htmlFor="edit-project-target-date">
            <Input
              id="edit-project-target-date"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </Field>
        </div>

        <Field label="Couleur" htmlFor="edit-project-color">
          <Input
            id="edit-project-color"
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
          />
        </Field>

        <InlineError error={error} />
      </div>
    </Modal>
  );
}
