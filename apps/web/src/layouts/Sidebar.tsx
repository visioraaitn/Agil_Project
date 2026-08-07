import { NavLink, useParams } from 'react-router-dom';
import {
  CalendarDays,
  ChevronDown,
  GitPullRequest,
  Home,
  KanbanSquare,
  LayoutGrid,
  ListTree,
  Map,
  PieChart,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const PROJECT_NAV: NavItem[] = [
  { to: 'overview', label: "Vue d'ensemble", icon: Home },
  { to: 'boards', label: 'Boards', icon: KanbanSquare },
  { to: 'backlog', label: 'Backlog', icon: ListTree },
  { to: 'sprints', label: 'Sprints', icon: CalendarDays },
  { to: 'roadmap', label: 'Roadmap', icon: Map },
  { to: 'repos', label: 'Repos & PR', icon: GitPullRequest },
  { to: 'dashboards', label: 'Dashboards', icon: PieChart },
];

// Phase 1 : alimenté par GET /projects (TanStack Query).
const DEMO_PROJECTS = [{ key: 'VIS', name: 'Plateforme Agile VisioraAI' }];

const linkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'flex items-center gap-2 rounded px-2 py-1 text-base transition-colors',
    isActive
      ? 'bg-accent-50 text-accent-700 font-semibold'
      : 'text-ink-700 hover:bg-surface-sunken',
  );

/** Navigation latérale : sélecteur de projet en haut, sections en dessous. */
export function Sidebar() {
  const { projectKey } = useParams<{ projectKey?: string }>();
  const activeProject = DEMO_PROJECTS.find((project) => project.key === projectKey);

  return (
    <nav
      className="border-border-default bg-surface-muted flex w-56 shrink-0 flex-col border-r"
      aria-label="Navigation principale"
    >
      {/* Sélecteur de projet */}
      <button
        type="button"
        className="border-border-default hover:bg-surface-sunken flex items-center gap-2 border-b px-2.5 py-2 text-left"
      >
        <span className="bg-accent-600 flex size-6 shrink-0 items-center justify-center rounded text-xs font-bold text-white">
          {activeProject?.key.slice(0, 2) ?? 'VI'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-ink-900 block truncate text-base font-semibold">
            {activeProject?.name ?? 'Tous les projets'}
          </span>
          <span className="text-ink-400 block text-xs">VisioraAI</span>
        </span>
        <ChevronDown className="text-ink-400 size-3.5 shrink-0" strokeWidth={2} />
      </button>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-1.5">
        <NavLink to="/portfolio" className={linkClass}>
          <LayoutGrid className="size-4 shrink-0" strokeWidth={1.75} />
          Portefeuille
        </NavLink>

        {projectKey && (
          <>
            <p className="text-ink-400 px-2 pt-3 pb-1 text-xs font-semibold uppercase">Projet</p>
            {PROJECT_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={`/projects/${projectKey}/${item.to}`}
                className={linkClass}
              >
                <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
                {item.label}
              </NavLink>
            ))}
          </>
        )}

        <p className="text-ink-400 px-2 pt-3 pb-1 text-xs font-semibold uppercase">
          Administration
        </p>
        <NavLink to="/admin/users" className={linkClass}>
          <Users className="size-4 shrink-0" strokeWidth={1.75} />
          Utilisateurs
        </NavLink>
      </div>

      <p className="text-ink-400 border-border-default border-t px-2.5 py-1.5 text-xs">
        v0.1.0 · phase 0
      </p>
    </nav>
  );
}
