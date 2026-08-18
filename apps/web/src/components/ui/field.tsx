import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}

/** Libellé + champ + message d'erreur, relié pour les lecteurs d'écran. */
export function Field({ label, htmlFor, error, hint, required, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-ink-700 text-sm font-semibold">
        {label}
        {required && <span className="text-danger ml-0.5">*</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : (
        hint && <p className="text-ink-400 text-sm">{hint}</p>
      )}
    </div>
  );
}
