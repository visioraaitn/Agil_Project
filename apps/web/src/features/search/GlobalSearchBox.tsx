import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useGlobalSearch } from '@/features/reports/hooks';

export function GlobalSearchBox() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data, isFetching } = useGlobalSearch(query.trim());

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-md">
      <div className="border-border-default bg-surface-muted focus-within:border-accent-500 flex h-6.5 items-center gap-1.5 rounded border px-2">
        <Search className="text-ink-400 size-3.5 shrink-0" strokeWidth={2} />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Rechercher un ticket, un projet..."
          className="text-ink-700 placeholder:text-ink-400 w-full bg-transparent text-sm outline-none"
          aria-label="Recherche globale"
        />
      </div>

      {open && query.trim().length >= 2 && (
        <div className="border-border-default bg-surface absolute inset-x-0 top-full z-40 mt-1 max-h-96 overflow-y-auto rounded border shadow-lg">
          {isFetching && <p className="text-ink-400 px-3 py-2 text-sm">Recherche...</p>}
          {!isFetching && (data ?? []).length === 0 && (
            <p className="text-ink-400 px-3 py-2 text-sm">Aucun resultat.</p>
          )}
          {data?.map((result) => (
            <Link
              key={`${result.type}-${result.id}`}
              to={result.url}
              onClick={() => setOpen(false)}
              className="border-border-subtle hover:bg-surface-sunken flex flex-col border-b px-3 py-2 last:border-b-0"
            >
              <span className="text-ink-900 truncate text-sm font-semibold">{result.title}</span>
              <span className="text-ink-500 text-xs">
                {result.type}
                {result.projectKey ? ` · ${result.projectKey}` : ''}
                {result.subtitle ? ` · ${result.subtitle}` : ''}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
