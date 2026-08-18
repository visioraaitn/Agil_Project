import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InlineError, LoadingState } from '@/components/common/StateMessage';
import { useAuth } from '../use-auth';

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<unknown>(null);

  // Le MÊME schéma Zod valide ce formulaire et le body côté API.
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  if (status === 'loading') return <LoadingState label="Restauration de la session…" />;
  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? '/portfolio'} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values);
    } catch (error) {
      setSubmitError(error);
    }
  });

  return (
    <div className="bg-surface-muted flex min-h-screen items-center justify-center p-6">
      <div className="bg-surface border-border-default w-full max-w-sm rounded border p-6 shadow-sm">
        <div className="mb-5">
          <p className="text-ink-900 text-2xl font-semibold tracking-tight">
            Visiora<span className="text-accent-500">AI</span>
          </p>
          <p className="text-ink-500 text-base">Plateforme de gestion de projets agile</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
          <Field label="Adresse email" htmlFor="email" error={errors.email?.message} required>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <Field label="Mot de passe" htmlFor="password" error={errors.password?.message} required>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              invalid={Boolean(errors.password)}
              {...register('password')}
            />
          </Field>

          <InlineError error={submitError} />

          <Button type="submit" variant="primary" loading={isSubmitting} className="mt-1 w-full">
            Se connecter
          </Button>
        </form>

        <p className="text-ink-400 mt-4 text-sm">
          Les comptes sont créés par un administrateur — il n'y a pas d'inscription libre.
        </p>
      </div>
    </div>
  );
}
