import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  GlobalRole,
  createUserSchema,
  updateUserSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserSummary,
} from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/common/StateMessage';
import { ApiError } from '@/lib/api-client';
import { useCreateUser, useUpdateUser } from '../hooks';

interface UserFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** `null` = création, sinon modification du compte fourni. */
  user: UserSummary | null;
}

export function UserFormDialog({ open, onClose, user }: UserFormDialogProps) {
  const isEdit = user !== null;
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const form = useForm<CreateUserInput | UpdateUserInput>({
    resolver: zodResolver(isEdit ? updateUserSchema : createUserSchema),
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (!open) return;
    reset(
      user
        ? {
            name: user.name,
            email: user.email,
            jobTitle: user.jobTitle ?? '',
            globalRole: user.globalRole,
            isActive: user.isActive,
          }
        : { globalRole: GlobalRole.MEMBER },
    );
    setSubmitError(null);
  }, [open, user, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      if (isEdit) {
        await updateUser.mutateAsync({ userId: user.id, input: values as UpdateUserInput });
      } else {
        await createUser.mutateAsync(values as CreateUserInput);
      }
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'UNIQUE_CONSTRAINT') {
        setError('email', { message: 'Cette adresse email est déjà utilisée' });
        return;
      }
      setSubmitError(error);
    }
  });

  const fieldErrors = errors as Record<string, { message?: string } | undefined>;

  return (
    <Modal
      open={open}
      title={isEdit ? 'Modifier le compte' : 'Nouveau compte'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={onSubmit} loading={isSubmitting}>
            {isEdit ? 'Enregistrer' : 'Créer le compte'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
        <Field label="Nom complet" htmlFor="name" error={fieldErrors.name?.message} required>
          <Input id="name" autoFocus invalid={Boolean(errors.name)} {...register('name')} />
        </Field>

        <Field label="Adresse email" htmlFor="email" error={fieldErrors.email?.message} required>
          <Input id="email" type="email" invalid={Boolean(errors.email)} {...register('email')} />
        </Field>

        <Field label="Fonction" htmlFor="jobTitle" error={fieldErrors.jobTitle?.message}>
          <Input id="jobTitle" {...register('jobTitle')} />
        </Field>

        {!isEdit && (
          <Field
            label="Mot de passe initial"
            htmlFor="password"
            error={fieldErrors.password?.message}
            hint="10 caractères minimum, avec majuscule, minuscule et chiffre."
            required
          >
            <Input
              id="password"
              type="text"
              autoComplete="new-password"
              invalid={Boolean(fieldErrors.password)}
              {...register('password')}
            />
          </Field>
        )}

        <Field
          label="Rôle plateforme"
          htmlFor="globalRole"
          error={fieldErrors.globalRole?.message}
          hint="Un administrateur gère les comptes et crée les projets. Les rôles agiles se définissent projet par projet."
        >
          <Select id="globalRole" {...register('globalRole')}>
            <option value={GlobalRole.MEMBER}>Membre</option>
            <option value={GlobalRole.ADMIN}>Administrateur</option>
          </Select>
        </Field>

        {isEdit && (
          <label className="text-ink-700 flex items-center gap-2 text-base">
            <input type="checkbox" {...register('isActive')} className="size-3.5" />
            Compte actif
            <span className="text-ink-400 text-sm">
              — désactiver coupe immédiatement toutes ses sessions
            </span>
          </label>
        )}

        <InlineError error={submitError} />
      </form>
    </Modal>
  );
}
