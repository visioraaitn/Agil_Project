import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Crumb {
  label: string;
  to?: string;
}

/** Fil d'Ariane discret au-dessus du titre de page. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Fil d'Ariane"
      className="text-ink-500 flex min-w-0 items-center gap-1.5 text-sm"
    >
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && (
              <ChevronRight className="text-ink-400 size-3.5 shrink-0" strokeWidth={2} />
            )}
            {item.to && !last ? (
              <Link to={item.to} className="hover:text-ink-900 truncate transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={cn('truncate', last && 'text-ink-900 font-medium')}>
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  breadcrumbs?: Crumb[];
  /** Compteur affiché en pastille à côté du titre (« 7 tickets »). */
  count?: ReactNode;
  /** Éléments placés juste après le titre (sélecteur de sprint, statut…). */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** En-tête standard des pages : fil d'Ariane, grand titre, compteur et actions. */
export function PageHeader({
  title,
  breadcrumbs,
  count,
  meta,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-2', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-ink-900 text-2xl font-bold tracking-tight">{title}</h1>
        {count !== undefined && count !== null && <span className="count-pill">{count}</span>}
        {meta}
        {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
