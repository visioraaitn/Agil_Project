import { useState, type ChangeEvent } from 'react';
import { FileText, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProjectSchema, type CreateProjectInput } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/common/StateMessage';
import { ApiError } from '@/lib/api-client';
import { projectsApi } from '../api';
import { useCreateProject } from '../hooks';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectKey: string) => void;
}

export function CreateProjectDialog({ open, onClose, onCreated }: CreateProjectDialogProps) {
  const createProject = useCreateProject();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [createdProjectKey, setCreatedProjectKey] = useState<string | null>(null);

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
    setPdfFiles([]);
    setCreatedProjectKey(null);
    onClose();
  };

  const selectPdfFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.currentTarget.files ?? []);
    setPdfFiles((current) => [
      ...current,
      ...selected.filter(
        (file) => !current.some((item) => item.name === file.name && item.size === file.size),
      ),
    ]);
    event.currentTarget.value = '';
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    let projectKey = createdProjectKey;
    try {
      if (!projectKey) {
        const project = await createProject.mutateAsync(values);
        projectKey = project.key;
        setCreatedProjectKey(project.key);
      }

      for (const file of pdfFiles) {
        await projectsApi.uploadDocument(projectKey, file);
        setPdfFiles((current) => current.filter((item) => item !== file));
      }

      onCreated?.(projectKey);
      close();
    } catch (error) {
      // Les erreurs de champ remontées par l'API se posent sur le formulaire.
      if (error instanceof ApiError && error.code === 'UNIQUE_CONSTRAINT') {
        setError('key', { message: 'Cette clé de projet est déjà utilisée' });
        return;
      }
      setSubmitError(
        projectKey
          ? new Error(
              'Le projet est créé. L’envoi d’un document a échoué ; réessayez pour envoyer les documents restants.',
            )
          : error,
      );
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
            {createdProjectKey ? 'Réessayer les documents' : 'Créer le projet'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <Field
          label="Clé du projet"
          htmlFor="key"
          error={errors.key?.message}
          hint="2 à 10 caractères — préfixe des tickets, ex. VIS-1-2"
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

        <Field
          label="Documents PDF"
          htmlFor="project-documents"
          hint="Optionnel — vous pouvez sélectionner plusieurs PDF et en ajouter d’autres plus tard."
        >
          <Input
            id="project-documents"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={selectPdfFiles}
          />
        </Field>
        {pdfFiles.length > 0 && (
          <ul className="border-border-subtle divide-border-subtle divide-y rounded border">
            {pdfFiles.map((file) => (
              <li key={`${file.name}-${file.size}`} className="flex items-center gap-2 px-2 py-1.5">
                <FileText className="text-danger size-3.5 shrink-0" strokeWidth={1.75} />
                <span className="text-ink-700 min-w-0 flex-1 truncate text-sm">{file.name}</span>
                <button
                  type="button"
                  className="text-ink-400 hover:text-danger rounded p-1"
                  aria-label={`Retirer ${file.name}`}
                  onClick={() => setPdfFiles((current) => current.filter((item) => item !== file))}
                >
                  <X className="size-3.5" strokeWidth={1.75} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de début" htmlFor="startDate" error={errors.startDate?.message}>
            <Input
              id="startDate"
              type="date"
              {...register('startDate', { setValueAs: (value) => value || null })}
            />
          </Field>
          <Field
            label="Échéance (optionnelle)"
            htmlFor="targetDate"
            error={errors.targetDate?.message}
            hint="Vous pourrez la définir ou la modifier plus tard."
          >
            <Input
              id="targetDate"
              type="date"
              {...register('targetDate', { setValueAs: (value) => value || null })}
            />
          </Field>
        </div>

        <InlineError error={submitError} />

        <p className="text-ink-400 text-sm">
          Vous serez ajouté comme Project Lead : cette responsabilité d'accès est distincte de votre
          fonction professionnelle et permet notamment l'approbation des Pull Requests.
        </p>
      </form>
    </Modal>
  );
}
