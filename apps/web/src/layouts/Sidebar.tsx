import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  Check,
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
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/use-auth';
import { useProjects } from '@/features/projects/hooks';

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
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data } = useProjects({ pageSize: 100 });
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const projects = data?.items ?? [];
  const activeProject = projects.find((project) => project.key === projectKey);

  // Referme le sélecteur au clic extérieur.
  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [pickerOpen]);

  const selectProject = (key: string) => {
    setPickerOpen(false);
    navigate(`/projects/${key}/overview`);
  };

  return (
    <nav
      className="border-border-default bg-surface-muted flex w-56 shrink-0 flex-col border-r"
      aria-label="Navigation principale"
    >
      <div ref={pickerRef} className="border-border-default relative border-b">
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          aria-haspopup="listbox"
          className="hover:bg-surface-sunken flex w-full items-center gap-2 px-2.5 py-2 text-left"
        >
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
            style={{ backgroundColor: activeProject?.color ?? '#0078D4' }}
          >
            {activeProject?.key.slice(0, 2) ?? 'VI'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-ink-900 block truncate text-base font-semibold">
              {activeProject?.name ?? 'Tous les projets'}
            </span>
            <span className="text-ink-400 block truncate text-xs">
              {activeProject?.company ?? 'VisioraAI'}
            </span>
          </span>
          <ChevronDown className="text-ink-400 size-3.5 shrink-0" strokeWidth={2} />
        </button>

        {pickerOpen && (
          <ul
            role="listbox"
            className="border-border-default bg-surface absolute inset-x-0 top-full z-40 max-h-72 overflow-y-auto border shadow-lg"
          >
            {projects.length === 0 && (
              <li className="text-ink-400 px-2.5 py-2 text-sm">Aucun projet accessible</li>
            )}
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={project.key === projectKey}
                  onClick={() => selectProject(project.key)}
                  className="hover:bg-surface-sunken flex w-full items-center gap-2 px-2.5 py-1.5 text-left"
                >
                  <span
                    className="flex size-5 shrink-0 items-center justify-center rounded text-xs font-bold text-white"
                    style={{ backgroundColor: project.color ?? '#0078D4' }}
                  >
                    {project.key.slice(0, 2)}
                  </span>
                  <span className="text-ink-700 min-w-0 flex-1 truncate text-base">
                    {project.name}
                  </span>
                  {project.key === projectKey && (
                    <Check className="text-accent-600 size-3.5 shrink-0" strokeWidth={2.5} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

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

        {isAdmin && (
          <>
            <p className="text-ink-400 px-2 pt-3 pb-1 text-xs font-semibold uppercase">
              Administration
            </p>
            <NavLink to="/admin/users" className={linkClass}>
              <Users className="size-4 shrink-0" strokeWidth={1.75} />
              Utilisateurs
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
}
