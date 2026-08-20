import { useEffect, useState } from 'react';
import { resetPasswordSchema, type UserSummary } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/common/StateMessage';
import { useResetPassword } from '../hooks';

interface ResetPasswordDialogProps {
  user: UserSummary | null;
  onClose: () => void;
  onSuccess: (user: UserSummary) => void;
}

export function ResetPasswordDialog({ user, onClose, onSuccess }: ResetPasswordDialogProps) {
  const resetPassword = useResetPassword();
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);

  useEffect(() => {
    if (!user) return;
    setNewPassword('');
    setConfirmation('');
    setValidationError(null);
    setSubmitError(null);
  }, [user]);

  const submit = async () => {
    if (!user) return;

    setValidationError(null);
    setSubmitError(null);
    const parsed = resetPasswordSchema.safeParse({ newPassword });
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Le mot de passe est invalide');
      return;
    }
    if (newPassword !== confirmation) {
      setValidationError('Les deux mots de passe ne correspondent pas');
      return;
    }

    try {
      await resetPassword.mutateAsync({ userId: user.id, newPassword });
      onSuccess(user);
      onClose();
    } catch (error) {
      setSubmitError(error);
    }
  };

  return (
    <Modal
      open={user !== null}
      title={
        user ? `Réinitialiser le mot de passe de ${user.name}` : 'Réinitialiser le mot de passe'
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={() => void submit()} loading={resetPassword.isPending}>
            Réinitialiser
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-ink-500 text-sm">
          Toutes les sessions ouvertes de cet utilisateur seront fermées.
        </p>
        <Field label="Nouveau mot de passe" htmlFor="reset-password" required>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Confirmer le mot de passe" htmlFor="reset-password-confirmation" required>
          <Input
            id="reset-password-confirmation"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void submit();
            }}
          />
        </Field>
        {validationError && (
          <p role="alert" className="bg-red-50 text-danger rounded px-2 py-1.5 text-base">
            {validationError}
          </p>
        )}
        <InlineError error={submitError} />
      </div>
    </Modal>
  );
}
