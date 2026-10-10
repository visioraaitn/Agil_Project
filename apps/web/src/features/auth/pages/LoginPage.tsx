import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { loginSchema, type LoginInput } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { BrandLogo } from '@/components/common/BrandLogo';
import { InlineError, LoadingState } from '@/components/common/StateMessage';
import { LoginBoardAnimation } from '../components/LoginBoardAnimation';
import { useAuth } from '../use-auth';

const FEATURES = ['Backlog', 'Kanban', 'Sprints', 'Git PR'];

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="bg-surface flex min-h-screen">
      <aside className="bg-accent-500 relative m-4 hidden flex-1 flex-col overflow-hidden rounded-2xl p-10 text-white lg:flex">
        {/* Trame de points et disque décoratif. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: 'radial-gradient(rgb(255 255 255 / 0.55) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
        <div
          aria-hidden="true"
          className="bg-accent-700/60 absolute -right-40 -bottom-56 size-[34rem] rounded-full"
        />

        <BrandLogo inverted className="relative" />

        <div className="relative flex flex-1 items-center justify-center py-10">
          <LoginBoardAnimation />
        </div>

        <div className="relative max-w-md">
          <h1 className="text-[2rem] leading-tight font-bold tracking-tight">
            Plateforme de gestion de projets agile
          </h1>
          <ul className="mt-5 flex flex-wrap gap-2">
            {FEATURES.map((feature) => (
              <li
                key={feature}
                className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur-sm"
              >
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <BrandLogo className="mb-10 lg:hidden" />

          <h2 className="text-ink-900 text-[1.75rem] font-bold tracking-tight">Se connecter</h2>
          <p className="text-ink-500 mt-1 text-md">Accédez à votre espace visioPlanner.</p>

          <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4" noValidate>
            <div className="pointer-events-none absolute -left-[10000px]" aria-hidden="true">
              <label htmlFor="contactWebsite">Site web</label>
              <input
                id="contactWebsite"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                {...register('contactWebsite')}
              />
            </div>

            <Field label="Adresse email" htmlFor="email" error={errors.email?.message} required>
              <div className="relative">
                <Mail
                  className="text-ink-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  strokeWidth={1.75}
                />
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  placeholder="nom@entreprise.com"
                  invalid={Boolean(errors.email)}
                  className="h-11 pl-9 text-md"
                  {...register('email')}
                />
              </div>
            </Field>

            <Field
              label="Mot de passe"
              htmlFor="password"
              error={errors.password?.message}
              required
            >
              <div className="relative">
                <Lock
                  className="text-ink-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  strokeWidth={1.75}
                />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  invalid={Boolean(errors.password)}
                  className="h-11 pr-10 pl-9 text-md"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Masquer la saisie' : 'Afficher la saisie'}
                  aria-pressed={showPassword}
                  className="text-ink-400 hover:text-ink-700 absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="size-4" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </Field>

            <InlineError error={submitError} />

            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting}
              className="mt-2 h-11 w-full text-md"
            >
              Se connecter
              {!isSubmitting && <ArrowRight strokeWidth={2} />}
            </Button>
          </form>

          <p className="border-accent-100 bg-accent-50/60 text-accent-700 mt-7 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm">
            <ShieldCheck className="mt-px size-4 shrink-0" strokeWidth={1.75} />
            Les comptes sont créés par un administrateur — il n'y a pas d'inscription libre.
          </p>
        </div>
      </main>
    </div>
  );
}
