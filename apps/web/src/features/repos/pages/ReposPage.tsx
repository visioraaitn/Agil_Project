import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  GitBranch,
  GitPullRequest,
  Plus,
  Search,
  Shield,
  Trash2,
} from 'lucide-react';
import {
  GitProvider,
  PullRequestStatus,
  WorkItemType,
  type BacklogNode,
  type BranchSummary,
  type RepositorySummary,
} from '@visiora/shared';
import {
  EmptyState,
  ErrorState,
  InlineError,
  LoadingState,
} from '@/components/common/StateMessage';
import { Avatar } from '@/components/common/Avatar';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useAuth } from '@/features/auth/use-auth';
import { useProjectPermissions } from '@/features/projects/hooks';
import { useBacklog } from '@/features/work-items/hooks';
import { safeHttpUrl } from '@/lib/security';
import { cn } from '@/lib/utils';
import {
  useBranches,
  useCreateBranch,
  useCreatePullRequest,
  useCreateRepository,
  useDeleteBranch,
  useDeleteRepository,
  usePullRequestDetail,
  usePullRequests,
  useRepositories,
  useUpdateRepository,
} from '../hooks';
import { DeleteBranchDialog } from '../components/DeleteBranchDialog';
import {
  PrStatusBadge,
  PrStatusIcon,
  PullRequestDetailView,
} from '../components/PullRequestDetailView';

/** Onglet souligné de la fiche dépôt, avec compteur en pastille. */
function RepoTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        '-mb-px flex items-center gap-2 border-b-2 pb-3 text-base font-medium transition-colors',
        active
          ? 'border-accent-500 text-accent-700 font-semibold'
          : 'text-ink-600 hover:text-ink-900 border-transparent',
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            'rounded-full px-1.5 py-px text-xs font-semibold tabular-nums',
            active ? 'bg-accent-50 text-accent-700' : 'bg-surface-sunken text-ink-500',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

const PROVIDER_STYLE: Partial<Record<string, string>> = {
  GITHUB: 'bg-surface-sunken text-ink-700',
  GITLAB: 'bg-orange-50 text-warning dark:bg-orange-950/40',
  BITBUCKET: 'bg-accent-50 text-accent-700',
  AZURE_DEVOPS: 'bg-accent-50 text-accent-700',
};

function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide',
        PROVIDER_STYLE[provider] ?? 'bg-surface-sunken text-ink-600',
      )}
    >
      {provider.replace('_', ' ')}
    </span>
  );
}

export function ReposPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const prParam = searchParams.get('pr');

  const { user } = useAuth();
  const { can } = useProjectPermissions(projectKey);

  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'pull_requests' | 'branches' | 'settings'>(
    'pull_requests',
  );
  const [prStatusFilter, setPrStatusFilter] = useState<string>('ALL');
  const [prSearchQuery, setPrSearchQuery] = useState('');

  const [repoDialogOpen, setRepoDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [prDialogOpen, setPrDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState<BranchSummary | null>(null);

  const { data: repositories, isLoading, error } = useRepositories(projectKey);
  const selectedRepository =
    repositories?.find((repository) => repository.id === selectedRepositoryId) ??
    repositories?.[0] ??
    null;

  const { data: branches, isLoading: branchesLoading } = useBranches(
    projectKey,
    selectedRepository?.id ?? null,
  );
  const {
    data: pullRequests,
    isLoading: prsLoading,
    error: prsError,
  } = usePullRequests(projectKey);

  const activePullRequestId = prParam ?? null;
  const { data: activePullRequestDetail, isLoading: prDetailLoading } = usePullRequestDetail(
    projectKey,
    activePullRequestId,
  );

  const deleteBranch = useDeleteBranch(projectKey, selectedRepository?.id ?? '');

  useEffect(() => {
    if (!selectedRepositoryId && repositories?.[0]) {
      setSelectedRepositoryId(repositories[0].id);
    }
  }, [repositories, selectedRepositoryId]);

  // Filtrage des Pull Requests
  const filteredPullRequests = useMemo(() => {
    if (!pullRequests) return [];
    return pullRequests.filter((pr) => {
      // Filtre dépôt sélectionné (si non global)
      if (selectedRepository && pr.repository.id !== selectedRepository.id) {
        return false;
      }

      // Filtre statut
      if (prStatusFilter === 'ACTIVE') {
        if (
          pr.status !== PullRequestStatus.OPEN &&
          pr.status !== PullRequestStatus.READY_FOR_APPROVAL &&
          pr.status !== PullRequestStatus.APPROVED &&
          pr.status !== PullRequestStatus.CHANGES_REQUESTED
        ) {
          return false;
        }
      } else if (prStatusFilter === 'MINE') {
        if (pr.declaredBy.id !== user?.id) return false;
      } else if (prStatusFilter !== 'ALL' && pr.status !== prStatusFilter) {
        return false;
      }

      // Filtre texte
      if (prSearchQuery.trim()) {
        const q = prSearchQuery.toLowerCase();
        const matchesTitle = pr.title.toLowerCase().includes(q);
        const matchesNumber = pr.number.toString().includes(q);
        const matchesAuthor = pr.declaredBy.name.toLowerCase().includes(q);
        const matchesWorkItem = pr.workItem.key.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNumber && !matchesAuthor && !matchesWorkItem) return false;
      }

      return true;
    });
  }, [pullRequests, selectedRepository, prStatusFilter, prSearchQuery, user?.id]);

  const handleSelectPr = (prId: string) => {
    setSearchParams({ pr: prId });
  };

  const handleBackToList = () => {
    setSearchParams({});
  };

  const handleDeleteBranchConfirm = async () => {
    if (!branchToDelete) return;
    await deleteBranch.mutateAsync(branchToDelete.id);
    setBranchToDelete(null);
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  // Si une PR spécifique est ouverte dans l'URL ou sélectionnée
  if (activePullRequestId) {
    if (prDetailLoading) return <LoadingState />;
    if (activePullRequestDetail) {
      return (
        <PullRequestDetailView
          projectRef={projectKey}
          pullRequest={activePullRequestDetail}
          onBack={handleBackToList}
        />
      );
    }
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 md:grid-cols-[300px_1fr]">
      {/* Colonne des dépôts */}
      <aside className="flex min-h-0 flex-col gap-3 px-4 pt-5 pb-4 sm:pl-6 md:pr-0 md:pb-6">
        <header className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-ink-900 text-xl font-bold tracking-tight">Dépôts Git</h1>
            <p className="text-ink-500 text-sm">
              {repositories?.length ?? 0} configuré{(repositories?.length ?? 0) > 1 ? 's' : ''}
            </p>
          </div>
          {can('repo:manage') && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setRepoDialogOpen(true)}
              title="Ajouter un dépôt"
            >
              <Plus strokeWidth={2.5} />
              Dépôt
            </Button>
          )}
        </header>

        <div className="scrollbar-thin -m-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-1">
          {(repositories ?? []).length === 0 ? (
            <div className="card">
              <EmptyState
                title="Aucun dépôt"
                description="Ajoutez le dépôt Git de votre projet pour activer les branches et Pull Requests."
              />
            </div>
          ) : (
            repositories?.map((repository) => (
              <button
                key={repository.id}
                type="button"
                onClick={() => setSelectedRepositoryId(repository.id)}
                aria-current={selectedRepository?.id === repository.id ? 'true' : undefined}
                className={cn(
                  'card group flex w-full flex-col gap-1.5 px-3.5 py-3 text-left transition-colors',
                  selectedRepository?.id === repository.id
                    ? 'border-accent-400 ring-accent-500/15 ring-3'
                    : 'hover:border-border-strong',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <GitBranch className="text-accent-600 size-4 shrink-0" strokeWidth={1.75} />
                    <span className="text-ink-900 truncate text-base font-semibold">
                      {repository.name}
                    </span>
                  </div>
                  <ProviderBadge provider={repository.provider} />
                </div>

                {repository.description && (
                  <p className="text-ink-500 line-clamp-2 text-sm">{repository.description}</p>
                )}

                <div className="text-ink-500 mt-0.5 flex items-center gap-4 text-sm">
                  <span>
                    {repository.branchCount} branche{repository.branchCount > 1 ? 's' : ''}
                  </span>
                  <span
                    className={cn(
                      repository.pullRequestCount > 0 && 'text-accent-600 font-semibold',
                    )}
                  >
                    {repository.pullRequestCount} PR{repository.pullRequestCount > 1 ? 's' : ''}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Contenu principal Dépôt sélectionné */}
      <main className="flex min-h-0 flex-col px-4 pt-5 pb-6 sm:px-6">
        {selectedRepository ? (
          <div className="card flex max-h-full min-h-0 flex-col overflow-hidden">
            {/* En-tête du dépôt sélectionné */}
            <header className="border-border-default border-b px-5 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-ink-900 text-2xl font-bold tracking-tight">
                      {selectedRepository.name}
                    </h2>
                    <span className="bg-surface-sunken text-ink-600 inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium">
                      <GitBranch className="size-3" strokeWidth={2} />
                      Branche par défaut :
                      <span className="text-ink-900 font-mono">
                        {selectedRepository.defaultBranch}
                      </span>
                    </span>
                  </div>
                  {safeHttpUrl(selectedRepository.url) ? (
                    <a
                      href={safeHttpUrl(selectedRepository.url) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-600 hover:text-accent-700 mt-1 block truncate text-sm hover:underline"
                    >
                      {selectedRepository.url}
                    </a>
                  ) : (
                    <p className="text-ink-500 mt-1 truncate text-sm">{selectedRepository.url}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {can('branch:create') && (
                    <Button onClick={() => setBranchDialogOpen(true)}>
                      <GitBranch strokeWidth={1.75} />
                      Nouvelle branche
                    </Button>
                  )}
                  {can('pr:declare') && (
                    <Button variant="primary" onClick={() => setPrDialogOpen(true)}>
                      <GitPullRequest strokeWidth={1.75} />
                      Créer Pull Request
                    </Button>
                  )}
                </div>
              </div>

              {/* Navigation des sous-onglets */}
              <nav className="mt-4 flex gap-6" aria-label="Sections du dépôt">
                <RepoTab
                  active={mainTab === 'pull_requests'}
                  onClick={() => setMainTab('pull_requests')}
                  label="Pull Requests"
                  count={selectedRepository.pullRequestCount}
                />
                <RepoTab
                  active={mainTab === 'branches'}
                  onClick={() => setMainTab('branches')}
                  label="Branches"
                  count={selectedRepository.branchCount}
                />
                {can('repo:manage') && (
                  <RepoTab
                    active={mainTab === 'settings'}
                    onClick={() => setMainTab('settings')}
                    label="Paramètres"
                  />
                )}
              </nav>
            </header>

            {/* Corps du sous-onglet actif */}
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-5">
              {/* ONGLET 1 : PULL REQUESTS */}
              {mainTab === 'pull_requests' && (
                <div className="flex flex-col gap-4">
                  {/* Barre de filtres et recherche */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { id: 'ALL', label: 'Toutes' },
                        { id: 'ACTIVE', label: 'Actives' },
                        { id: 'MINE', label: 'Mes PRs' },
                        { id: PullRequestStatus.READY_FOR_APPROVAL, label: 'En attente' },
                        { id: PullRequestStatus.APPROVED, label: 'Approuvées' },
                        { id: PullRequestStatus.CHANGES_REQUESTED, label: 'Modifs demandées' },
                        { id: PullRequestStatus.MERGED, label: 'Fusionnées' },
                        { id: PullRequestStatus.REJECTED, label: 'Rejetées' },
                        { id: PullRequestStatus.CLOSED, label: 'Fermées' },
                      ].map((filter) => (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => setPrStatusFilter(filter.id)}
                          aria-pressed={prStatusFilter === filter.id}
                          className={cn(
                            'h-8 rounded-full border px-3.5 text-sm font-medium transition-colors',
                            prStatusFilter === filter.id
                              ? 'bg-accent-500 border-accent-500 text-white shadow-raised'
                              : 'border-border-default bg-surface text-ink-700 hover:border-border-strong hover:text-ink-900',
                          )}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative ml-auto w-full sm:w-72">
                      <Search
                        className="text-ink-400 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                        strokeWidth={2}
                      />
                      <input
                        value={prSearchQuery}
                        onChange={(e) => setPrSearchQuery(e.target.value)}
                        placeholder="Rechercher (#, titre, auteur)…"
                        aria-label="Rechercher une Pull Request"
                        className="search-field h-9 pl-9"
                      />
                    </div>
                  </div>

                  {/* Liste des PRs */}
                  {prsLoading ? (
                    <LoadingState />
                  ) : prsError ? (
                    <ErrorState error={prsError} />
                  ) : filteredPullRequests.length === 0 ? (
                    <EmptyState
                      title="Aucune Pull Request correspondante"
                      description="Modifiez vos filtres ou créez une nouvelle Pull Request pour ce dépôt."
                    />
                  ) : (
                    <div className="divide-border-subtle -mx-5 divide-y">
                      {filteredPullRequests.map((pr) => (
                        <div
                          key={pr.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectPr(pr.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleSelectPr(pr.id);
                            }
                          }}
                          className="hover:bg-surface-muted group flex cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors"
                        >
                          <PrStatusIcon status={pr.status} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-ink-500 text-sm">#{pr.number}</span>
                              <span className="text-ink-900 group-hover:text-accent-700 truncate text-base font-semibold">
                                {pr.title}
                              </span>
                              <PrStatusBadge status={pr.status} />
                            </div>

                            <div className="text-ink-500 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                              <span className="bg-accent-50 text-accent-700 rounded-md px-1.5 py-px font-mono text-xs font-semibold">
                                {pr.workItem.key}
                              </span>
                              <span className="text-ink-700 inline-flex items-center gap-1.5 font-mono text-xs">
                                {pr.sourceBranch.name}
                                <ArrowRight className="text-ink-400 size-3" />
                                {pr.targetBranch?.name ?? pr.targetBranchName ?? 'main'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>Ouverte par {pr.declaredBy.name}</span>
                              <span aria-hidden="true">·</span>
                              <span className="flex items-center gap-1">
                                <Clock className="size-3.5" strokeWidth={1.75} />
                                {new Date(pr.createdAt).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          </div>

                          <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                            <span className="text-ink-500 text-xs">Revue</span>
                            {pr.reviewedBy ? (
                              <span className="text-ink-900 flex items-center gap-1.5 text-sm font-medium">
                                <Avatar name={pr.reviewedBy.name} size="xs" />
                                {pr.reviewedBy.name}
                              </span>
                            ) : (
                              <span className="text-ink-500 text-sm">Non assignée</span>
                            )}
                          </div>
                          <ChevronRight className="text-ink-400 group-hover:text-ink-900 size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ONGLET 2 : BRANCHES */}
              {mainTab === 'branches' && (
                <div className="flex flex-col gap-4">
                  {branchesLoading ? (
                    <LoadingState />
                  ) : (branches ?? []).length === 0 ? (
                    <EmptyState title="Aucune branche enregistrée" />
                  ) : (
                    <div className="border-border-default divide-border-subtle divide-y overflow-hidden rounded-xl border">
                      <div className="bg-surface-muted text-ink-500 grid grid-cols-[1fr_120px_180px_100px] gap-2 px-4 py-2.5 text-[11px] font-semibold tracking-wider uppercase">
                        <span>Nom de la branche</span>
                        <span>Type</span>
                        <span>Créateur & Date</span>
                        <span className="text-right">Actions</span>
                      </div>

                      {branches?.map((branch) => {
                        const isDefault = branch.name === selectedRepository.defaultBranch;
                        const canDelete =
                          !isDefault &&
                          (can('branch:delete') ||
                            (branch.createdBy?.id === user?.id && !branch.isProtected));

                        return (
                          <div
                            key={branch.id}
                            className="hover:bg-surface-muted grid grid-cols-[1fr_120px_180px_100px] items-center gap-2 px-4 py-3 text-sm"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <GitBranch
                                className="text-accent-600 size-4 shrink-0"
                                strokeWidth={1.75}
                              />
                              <span className="text-ink-900 truncate font-mono text-[13px] font-medium">
                                {branch.name}
                              </span>
                              {isDefault && <Badge tone="accent">Défaut</Badge>}
                              {branch.isProtected && (
                                <Badge tone="success">
                                  <Shield className="size-3" strokeWidth={2} />
                                  Protégée
                                </Badge>
                              )}
                            </div>

                            <div>
                              {branch.isLocalOnly ? (
                                <Badge tone="warning">Locale</Badge>
                              ) : (
                                <span className="text-ink-500 text-sm">Distante</span>
                              )}
                            </div>

                            <div className="text-ink-500 truncate">
                              {branch.createdBy ? branch.createdBy.name : 'Système'} ·{' '}
                              {new Date(branch.createdAt).toLocaleDateString('fr-FR')}
                            </div>

                            <div className="flex justify-end">
                              {canDelete && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-danger hover:bg-red-50 dark:hover:bg-red-950 p-1 size-7"
                                  onClick={() => setBranchToDelete(branch)}
                                  title="Supprimer la branche"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ONGLET 3 : PARAMÈTRES DÉPÔT */}
              {mainTab === 'settings' && (
                <RepositorySettingsView
                  projectRef={projectKey}
                  repository={selectedRepository}
                  onDeleted={() => setSelectedRepositoryId(null)}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="card">
            <EmptyState
              title="Aucun dépôt sélectionné"
              description="Sélectionnez un dépôt dans le panneau latéral ou ajoutez-en un nouveau."
            />
          </div>
        )}
      </main>

      {/* Modals de création */}
      <CreateRepositoryDialog
        projectRef={projectKey}
        open={repoDialogOpen}
        onClose={() => setRepoDialogOpen(false)}
        onCreated={setSelectedRepositoryId}
      />

      {selectedRepository && (
        <>
          <CreateBranchDialog
            projectRef={projectKey}
            repository={selectedRepository}
            open={branchDialogOpen}
            onClose={() => setBranchDialogOpen(false)}
          />

          <CreatePullRequestDialog
            projectRef={projectKey}
            repository={selectedRepository}
            branches={branches ?? []}
            open={prDialogOpen}
            onClose={() => setPrDialogOpen(false)}
            onCreated={(pr) => handleSelectPr(pr.id)}
          />

          <DeleteBranchDialog
            open={Boolean(branchToDelete)}
            branch={branchToDelete}
            onClose={() => setBranchToDelete(null)}
            onConfirm={handleDeleteBranchConfirm}
            loading={deleteBranch.isPending}
          />
        </>
      )}
    </div>
  );
}

function RepositorySettingsView({
  projectRef,
  repository,
  onDeleted,
}: {
  projectRef: string;
  repository: RepositorySummary;
  onDeleted: () => void;
}) {
  const updateRepo = useUpdateRepository(projectRef);
  const deleteRepo = useDeleteRepository(projectRef);

  const [name, setName] = useState(repository.name);
  const [description, setDescription] = useState(repository.description ?? '');
  const [url, setUrl] = useState(repository.url);
  const [defaultBranch, setDefaultBranch] = useState(repository.defaultBranch);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    await updateRepo.mutateAsync({
      repositoryId: repository.id,
      input: { name, description, url, defaultBranch },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleDelete = async () => {
    if (
      confirm(`Êtes-vous certain de vouloir supprimer définitivement le dépôt ${repository.name} ?`)
    ) {
      await deleteRepo.mutateAsync(repository.id);
      onDeleted();
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="border-border-default bg-surface rounded-lg border p-5 shadow-sm space-y-4">
        <h3 className="text-ink-900 text-base font-bold">Configuration du Dépôt</h3>
        <InlineError error={updateRepo.error} />

        <Field label="Nom du dépôt" htmlFor="edit-repo-name" required>
          <Input id="edit-repo-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Description" htmlFor="edit-repo-desc">
          <Textarea
            id="edit-repo-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <Field label="URL Git distante" htmlFor="edit-repo-url" required>
          <Input id="edit-repo-url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>

        <Field label="Branche par défaut" htmlFor="edit-repo-default">
          <Input
            id="edit-repo-default"
            value={defaultBranch}
            onChange={(e) => setDefaultBranch(e.target.value)}
          />
        </Field>

        <div className="flex items-center justify-between pt-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <CheckCircle2 className="size-3.5" /> Enregistré avec succès
            </span>
          )}
          <div className="ml-auto">
            <Button variant="primary" onClick={handleSave} loading={updateRepo.isPending}>
              Sauvegarder les modifications
            </Button>
          </div>
        </div>
      </div>

      <div className="border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20 rounded-lg border p-5 shadow-sm">
        <h3 className="text-danger text-base font-bold">Zone de danger</h3>
        <p className="text-ink-600 text-xs mt-1">
          La suppression d'un dépôt supprime l'ensemble de ses branches et de ses Pull Requests
          référencées.
        </p>
        <div className="mt-4">
          <Button variant="danger" onClick={handleDelete} loading={deleteRepo.isPending}>
            Supprimer ce dépôt
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateRepositoryDialog({
  projectRef,
  open,
  onClose,
  onCreated,
}: {
  projectRef: string;
  open: boolean;
  onClose: () => void;
  onCreated: (repositoryId: string) => void;
}) {
  const createRepository = useCreateRepository(projectRef);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState<GitProvider>(GitProvider.GITHUB);
  const [defaultBranch, setDefaultBranch] = useState('main');

  const submit = async () => {
    const repository = await createRepository.mutateAsync({
      name,
      description: description.trim() || null,
      url,
      provider,
      defaultBranch,
    });
    onCreated(repository.id);
    setName('');
    setDescription('');
    setUrl('');
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Ajouter un Dépôt Git"
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={submit} loading={createRepository.isPending}>
            Créer le dépôt
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <InlineError error={createRepository.error} />
        <Field label="Nom du dépôt" htmlFor="repo-name" required>
          <Input
            id="repo-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="visiora-frontend"
          />
        </Field>
        <Field label="Description" htmlFor="repo-desc">
          <Input
            id="repo-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Monorepo Frontend React..."
          />
        </Field>
        <Field label="URL du dépôt distant" htmlFor="repo-url" required>
          <Input
            id="repo-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/mon-orga/mon-depot"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fournisseur Git" htmlFor="repo-provider">
            <Select
              id="repo-provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as GitProvider)}
            >
              {Object.values(GitProvider).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Branche principale" htmlFor="repo-default-branch">
            <Input
              id="repo-default-branch"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function CreateBranchDialog({
  projectRef,
  repository,
  open,
  onClose,
}: {
  projectRef: string;
  repository: RepositorySummary;
  open: boolean;
  onClose: () => void;
}) {
  const createBranch = useCreateBranch(projectRef, repository.id);
  const [name, setName] = useState('');
  const [isProtected, setIsProtected] = useState(false);

  const submit = async () => {
    await createBranch.mutateAsync({ name, isLocalOnly: true, isProtected });
    setName('');
    setIsProtected(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Créer une branche"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={submit} loading={createBranch.isPending}>
            Créer la branche
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <InlineError error={createBranch.error} />
        <Field label="Nom de la branche" htmlFor="branch-name" required>
          <Input
            id="branch-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="feature/authentification-oauth"
          />
        </Field>
        <label className="flex items-center gap-2 text-xs font-semibold text-ink-700 dark:text-ink-300 mt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={isProtected}
            onChange={(e) => setIsProtected(e.target.checked)}
            className="rounded border-border-default text-accent-600"
          />
          <span>Branche protégée (exige une Pull Request pour fusionner)</span>
        </label>
      </div>
    </Modal>
  );
}

function CreatePullRequestDialog({
  projectRef,
  repository,
  branches,
  open,
  onClose,
  onCreated,
}: {
  projectRef: string;
  repository: RepositorySummary;
  branches: BranchSummary[];
  open: boolean;
  onClose: () => void;
  onCreated: (pr: { id: string }) => void;
}) {
  const createPullRequest = useCreatePullRequest(projectRef);
  const { data: backlog } = useBacklog(projectRef, {});
  const workItems = useMemo(
    () => flattenBacklog(backlog ?? []).filter((item) => item.type !== WorkItemType.EPIC),
    [backlog],
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [workItemId, setWorkItemId] = useState('');
  const [sourceBranchId, setSourceBranchId] = useState('');
  const [targetBranchId, setTargetBranchId] = useState('');
  const [externalUrl, setExternalUrl] = useState('');

  const submit = async () => {
    const pr = await createPullRequest.mutateAsync({
      repositoryId: repository.id,
      workItemId,
      title,
      description: description.trim() || null,
      sourceBranchId,
      targetBranchId: targetBranchId || null,
      externalUrl: externalUrl || null,
    });
    setTitle('');
    setDescription('');
    onCreated(pr);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Créer une Pull Request"
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="primary" onClick={submit} loading={createPullRequest.isPending}>
            Créer la Pull Request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <InlineError error={createPullRequest.error} />

        <Field label="Ticket associé *" htmlFor="pr-work-item" required>
          <Select
            id="pr-work-item"
            value={workItemId}
            onChange={(e) => setWorkItemId(e.target.value)}
          >
            <option value="">Sélectionner un ticket du backlog...</option>
            {workItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.key} · {item.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Titre de la PR *" htmlFor="pr-title" required>
          <Input
            id="pr-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="feat(auth): Refonte de l'écran de connexion"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Branche Source *" htmlFor="pr-source" required>
            <Select
              id="pr-source"
              value={sourceBranchId}
              onChange={(e) => setSourceBranchId(e.target.value)}
            >
              <option value="">Sélectionner source...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Branche Cible *" htmlFor="pr-target" required>
            <Select
              id="pr-target"
              value={targetBranchId}
              onChange={(e) => setTargetBranchId(e.target.value)}
            >
              <option value="">Sélectionner cible...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.isProtected ? '🛡️ (Protégée)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Description détaillée (Markdown)" htmlFor="pr-description">
          <MarkdownEditor
            value={description}
            onChange={setDescription}
            minHeight="140px"
            placeholder="Décrire les changements apportés, la méthodologie de test, les impacts..."
          />
        </Field>

        <Field label="Lien externe vers le provider Git (optionnel)" htmlFor="pr-url">
          <Input
            id="pr-url"
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="https://github.com/.../pull/142"
          />
        </Field>
      </div>
    </Modal>
  );
}

function flattenBacklog(nodes: BacklogNode[]): BacklogNode[] {
  return nodes.flatMap((node) => [node, ...flattenBacklog(node.children)]);
}
