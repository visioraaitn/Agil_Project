import { Bell, Search, Settings } from 'lucide-react';
import { initials } from '../lib/utils';

/** Barre supérieure : recherche globale (F.4), notifications (G.1), compte. */
export function Topbar() {
  // Phase 1 : remplacé par l'utilisateur de la session.
  const currentUser = { name: 'Yassine Affes', email: 'admin@visiora.ai' };

  return (
    <header className="border-border-default bg-surface flex h-10 shrink-0 items-center gap-3 border-b px-3">
      <span className="text-ink-900 text-lg font-semibold tracking-tight">
        Visiora<span className="text-accent-500">AI</span>
      </span>
      <span className="text-ink-400 text-sm">Agile</span>

      <div className="mx-auto w-full max-w-md">
        <div className="border-border-default bg-surface-muted focus-within:border-accent-500 flex h-6.5 items-center gap-1.5 rounded border px-2">
          <Search className="text-ink-400 size-3.5 shrink-0" strokeWidth={2} />
          <input
            type="search"
            placeholder="Rechercher un ticket, un projet…"
            className="text-ink-700 placeholder:text-ink-400 w-full bg-transparent text-sm outline-none"
            aria-label="Recherche globale"
          />
        </div>
      </div>

      <button
        type="button"
        className="text-ink-500 hover:bg-surface-sunken relative rounded p-1"
        aria-label="Notifications"
      >
        <Bell className="size-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="text-ink-500 hover:bg-surface-sunken rounded p-1"
        aria-label="Paramètres"
      >
        <Settings className="size-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="bg-accent-600 size-6 shrink-0 rounded-full text-xs font-semibold text-white"
        title={currentUser.email}
        aria-label={`Compte de ${currentUser.name}`}
      >
        {initials(currentUser.name)}
      </button>
    </header>
  );
}
