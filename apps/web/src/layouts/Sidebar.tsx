import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  ChevronsUpDown,
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
import {
  ProjectStatus,
  PullRequestStatus,
  SprintStatus,
  type BacklogNode,
  type ProjectSummary,
  type SprintSummary,
} from '@visiora/shared';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/common/BrandLogo';
import { ProjectTile } from '@/components/common/ProjectTile';
import { useAuth } from '@/features/auth/use-auth';
import { useProjects } from '@/features/projects/hooks';
import { useSprints } from '@/features/sprints/hooks';
import { useBacklog } from '@/features/work-items/hooks';
import { usePullRequests } from '@/features/repos/hooks';

type NavKey = 'overview' | 'boards' | 'backlog' | 'sprints' | 'roadmap' | 'repos' | 'dashboards';

interface NavItem {
  to: NavKey;
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

/** Une PR « en vie » attend encore une action : ni fusionnée, ni fermée, ni rejetée. */
const CLOSED_PR_STATUSES = new Set<string>([
  PullRequestStatus.MERGED,
  PullRequestStatus.CLOSED,
  PullRequestStatus.REJECTED,
]);

function projectStateLabel(project: ProjectSummary): string {
  if (project.effectiveStatus === ProjectStatus.ACTIVE && project.activeSprint) {
    return `En cours · ${project.activeSprint.name}`;
  }
  if (project.effectiveStatus === ProjectStatus.ON_HOLD) return 'En pause';
  if (project.effectiveStatus === ProjectStatus.COMPLETED) return 'Terminé';
  return 'Archivé';
}

function countNodes(nodes: BacklogNode[] | undefined): number {
  if (!nodes) return 0;
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
}

const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });
const dayMonthYear = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function sprintRange(sprint: SprintSummary): string {
  return `${dayMonth.format(new Date(sprint.startDate))} – ${dayMonthYear.format(new Date(sprint.endDate))}`;
}

const linkClass =
  (collapsed: boolean) =>
  ({ isActive }: { isActive: boolean }): string =>
    cn(
      'group flex h-9 items-center gap-3 rounded-lg px-2.5 text-md whitespace-nowrap transition-colors',
      collapsed && 'md:justify-center md:px-0',
      isActive
        ? 'bg-accent-50 text-accent-700 font-semibold'
        : 'text-ink-700 hover:bg-surface-sunken hover:text-ink-900',
    );

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

/** Délai avant repli quand la souris quitte la barre : évite les fermetures intempestives. */
const COLLAPSE_DELAY_MS = 150;

/**
 * Navigation latérale responsive.
 * - Ordinateur : rail d'icônes par défaut ; la barre se déploie au survol (ou
 *   quand le focus clavier y entre) par-dessus le contenu, sans le décaler, et
 *   se replie quand la souris s'éloigne.
 * - Mobile : tiroir complet ouvert depuis la barre supérieure.
 */
export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { projectKey } = useParams<{ projectKey?: string }>();
  const { canManageUsers } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = useProjects({ pageSize: 100 });
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const collapseTimer = useRef<number | undefined>(undefined);
  // Les classes « collapsed » ne s'appliquent qu'à partir de md : le tiroir mobile reste complet.
  const collapsed = !expanded;

  const expand = () => {
    window.clearTimeout(collapseTimer.current);
    setExpanded(true);
  };
  const scheduleCollapse = () => {
    window.clearTimeout(collapseTimer.current);
    collapseTimer.current = window.setTimeout(() => {
      setExpanded(false);
      setPickerOpen(false);
    }, COLLAPSE_DELAY_MS);
  };
  useEffect(() => () => window.clearTimeout(collapseTimer.current), []);

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

  useEffect(() => {
    onMobileClose();
    setPickerOpen(false);
  }, [location.pathname, onMobileClose]);

  const selectProject = (key: string) => {
    setPickerOpen(false);
    navigate(`/projects/${key}/overview`);
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-label="Fermer la navigation"
          onClick={onMobileClose}
        />
      )}
      {/* Le rail réserve sa largeur dans la mise en page ; la barre déployée passe par-dessus. */}
      <div className="relative shrink-0 md:w-[72px]">
        <nav
          onMouseEnter={expand}
          onMouseLeave={scheduleCollapse}
          onFocus={expand}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null))
              scheduleCollapse();
          }}
          className={cn(
            'border-border-default bg-surface-muted fixed inset-y-0 left-0 z-40 flex w-64 max-w-[85vw] flex-col overflow-hidden border-r transition-[transform,width,box-shadow] duration-200 ease-out md:absolute md:max-w-none md:translate-x-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
            collapsed ? 'md:w-[72px]' : 'md:w-60 md:shadow-pop',
          )}
          aria-label="Navigation principale"
        >
          <Link
            to="/portfolio"
            className={cn(
              'flex h-15 shrink-0 items-center px-4',
              collapsed && 'md:justify-center md:px-0',
            )}
            aria-label="visioPlanner — accueil"
          >
            <BrandLogo className={cn(collapsed && 'md:[&>span:last-child]:hidden')} />
          </Link>

          <div ref={pickerRef} className={cn('relative px-3 pb-3', collapsed && 'md:px-2')}>
            <button
              type="button"
              onClick={() => setPickerOpen((open) => !open)}
              aria-expanded={pickerOpen}
              aria-haspopup="listbox"
              className={cn(
                'card hover:border-border-strong flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors',
                collapsed && 'md:justify-center md:px-0',
              )}
              title={collapsed ? (activeProject?.name ?? 'Tous les projets') : undefined}
            >
              <ProjectTile project={activeProject} />
              <span className={cn('min-w-0 flex-1', collapsed && 'md:hidden')}>
                <span className="text-ink-900 block truncate text-base font-semibold">
                  {activeProject?.name ?? 'Tous les projets'}
                </span>
                <span className="text-ink-500 block truncate text-xs">
                  {activeProject ? projectStateLabel(activeProject) : 'visioPlanner'}
                </span>
              </span>
              <ChevronsUpDown
                className={cn('text-ink-400 size-4 shrink-0', collapsed && 'md:hidden')}
                strokeWidth={2}
              />
            </button>

            {pickerOpen && (
              <ul
                role="listbox"
                className={cn(
                  'border-border-default bg-surface absolute inset-x-3 top-full z-40 -mt-1.5 max-h-80 overflow-y-auto rounded-xl border p-1 shadow-pop',
                  collapsed && 'md:left-full md:right-auto md:top-0 md:mt-0 md:ml-1 md:w-72',
                )}
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
                      className="hover:bg-surface-sunken flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left"
                    >
                      <ProjectTile project={project} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="text-ink-900 block truncate text-base font-medium">
                          {project.name}
                        </span>
                        <span className="text-ink-500 block truncate text-xs">
                          {projectStateLabel(project)}
                        </span>
                      </span>
                      {project.key === projectKey && (
                        <Check className="text-accent-600 size-4 shrink-0" strokeWidth={2.5} />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className={cn('scrollbar-thin flex-1 overflow-y-auto px-3', collapsed && 'md:px-2')}>
            <NavLink
              to="/portfolio"
              className={linkClass(collapsed)}
              title={collapsed ? 'Portefeuille' : undefined}
            >
              <LayoutGrid className="size-[18px] shrink-0" strokeWidth={1.75} />
              <span className={cn(collapsed && 'md:hidden')}>Portefeuille</span>
            </NavLink>

            {projectKey && <ProjectNav projectKey={projectKey} collapsed={collapsed} />}

            {canManageUsers && (
              <>
                <SectionLabel collapsed={collapsed}>Administration</SectionLabel>
                <NavLink
                  to="/admin/users"
                  className={linkClass(collapsed)}
                  title={collapsed ? 'Utilisateurs' : undefined}
                >
                  <Users className="size-[18px] shrink-0" strokeWidth={1.75} />
                  <span className={cn(collapsed && 'md:hidden')}>Utilisateurs</span>
                </NavLink>
              </>
            )}
          </div>

          {projectKey && (
            <div className={cn('w-60 max-w-full shrink-0 p-3', collapsed && 'md:hidden')}>
              <ActiveSprintCard projectKey={projectKey} />
            </div>
          )}
        </nav>
      </div>
    </>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: string }) {
  return (
    <p
      className={cn(
        'text-ink-400 px-2.5 pt-5 pb-1.5 text-[11px] font-semibold tracking-wider uppercase',
        collapsed && 'md:hidden',
      )}
    >
      {children}
    </p>
  );
}

const EMPTY_FILTERS = {};

/** Sections du projet, avec les compteurs du sprint actif, du backlog et des PR ouvertes. */
function ProjectNav({ projectKey, collapsed }: { projectKey: string; collapsed: boolean }) {
  const { data: sprints } = useSprints(projectKey);
  const { data: backlog } = useBacklog(projectKey, EMPTY_FILTERS);
  const { data: pullRequests } = usePullRequests(projectKey);

  const counts = useMemo<Partial<Record<NavKey, number>>>(() => {
    const activeSprint = sprints?.find((sprint) => sprint.status === SprintStatus.ACTIVE);
    return {
      boards: activeSprint?.totalItems,
      backlog: backlog ? countNodes(backlog) : undefined,
      repos: pullRequests?.filter((pr) => !CLOSED_PR_STATUSES.has(pr.status)).length,
    };
  }, [sprints, backlog, pullRequests]);

  return (
    <>
      <SectionLabel collapsed={collapsed}>Projet</SectionLabel>
      <div className="space-y-0.5">
        {PROJECT_NAV.map((item) => {
          const count = counts[item.to];
          return (
            <NavLink
              key={item.to}
              to={`/projects/${projectKey}/${item.to}`}
              className={linkClass(collapsed)}
              title={collapsed ? item.label : undefined}
              // Le compteur est un complément visuel : le nom du lien reste son libellé.
              aria-label={item.label}
            >
              <item.icon className="size-[18px] shrink-0" strokeWidth={1.75} />
              <span className={cn('flex-1 truncate', collapsed && 'md:hidden')}>{item.label}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    collapsed && 'md:hidden',
                    item.to === 'repos'
                      ? 'bg-accent-500 min-w-5 rounded-full px-1.5 py-px text-center font-bold text-white'
                      : 'text-ink-500 font-medium',
                  )}
                >
                  {count}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>
    </>
  );
}

/** Rappel permanent du sprint actif en pied de navigation. */
function ActiveSprintCard({ projectKey }: { projectKey: string }) {
  const { data: sprints } = useSprints(projectKey);
  const sprint = sprints?.find((candidate) => candidate.status === SprintStatus.ACTIVE);
  if (!sprint) return null;

  const total = sprint.liveCommittedPoints;
  const done = sprint.liveCompletedPoints;
  const progress = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const shortName = sprint.name.split('·')[0]?.trim() || sprint.name;

  return (
    <Link
      to={`/projects/${projectKey}/sprints`}
      className="card hover:border-border-strong block px-3 py-2.5 transition-colors"
      title={sprint.name}
    >
      <span className="flex items-center gap-2">
        <span className="bg-success size-2 shrink-0 rounded-full" />
        <span className="text-ink-900 min-w-0 flex-1 truncate text-sm font-semibold">
          {shortName} · Actif
        </span>
        <span className="text-ink-500 text-xs tabular-nums">
          {done}/{total} pts
        </span>
      </span>
      <span className="bg-surface-sunken mt-2 block h-1.5 overflow-hidden rounded-full">
        <span
          className="bg-accent-500 block h-full rounded-full"
          style={{ width: `${progress}%` }}
        />
      </span>
      <span className="text-ink-500 mt-1.5 block text-xs">{sprintRange(sprint)}</span>
    </Link>
  );
}
