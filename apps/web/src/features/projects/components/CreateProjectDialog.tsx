import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProjectSchema, type CreateProjectInput } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/common/StateMessage';
import { ApiError } from '@/lib/api-client';
import { useCreateProject } from '../hooks';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectKey: string) => void;
}

export function CreateProjectDialog({ open, onClose, onCreated }: CreateProjectDialogProps) {
  const createProject = useCreateProject();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({ resolver: zodResolver(createProjectSchema) });

  const close = () => {
    reset();
    setSubmitError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const project = await createProject.mutateAsync(values);
      onCreated?.(project.key);
      close();
    } catch (error) {
      // Les erreurs de champ remontées par l'API se posent sur le formulaire.
      if (error instanceof ApiError && error.code === 'UNIQUE_CONSTRAINT') {
        setError('key', { message: 'Cette clé de projet est déjà utilisée' });
        return;
      }
      setSubmitError(error);
    }
  });

  return (
    <Modal
      open={open}
      title="Nouveau projet"
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Annuler</Button>
          <Button variant="primary" onClick={onSubmit} loading={isSubmitting}>
            Créer le projet
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <Field
          label="Clé du projet"
          htmlFor="key"
          error={errors.key?.message}
          hint="2 à 10 caractères — préfixe des tickets, ex. VIS-142"
          required
        >
          <Input
            id="key"
            autoFocus
            placeholder="VIS"
            className="uppercase"
            invalid={Boolean(errors.key)}
            {...register('key')}
          />
        </Field>

        <Field label="Nom" htmlFor="name" error={errors.name?.message} required>
          <Input id="name" invalid={Boolean(errors.name)} {...register('name')} />
        </Field>

        <Field label="Entreprise" htmlFor="company" error={errors.company?.message}>
          <Input id="company" {...register('company')} />
        </Field>

        <Field label="Description" htmlFor="description" error={errors.description?.message}>
          <Textarea id="description" rows={3} {...register('description')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de début" htmlFor="startDate" error={errors.startDate?.message}>
            <Input id="startDate" type="date" {...register('startDate')} />
          </Field>
          <Field label="Échéance" htmlFor="targetDate" error={errors.targetDate?.message}>
            <Input id="targetDate" type="date" {...register('targetDate')} />
          </Field>
        </div>

        <InlineError error={submitError} />

        <p className="text-ink-400 text-sm">
          Vous serez ajouté comme Product Owner : sans ce rôle, aucune Pull Request ne pourrait être
          approuvée sur le projet.
        </p>
      </form>
    </Modal>
  );
}
