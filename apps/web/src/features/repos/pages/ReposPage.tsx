import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  GitBranch,
  GitPullRequest,
  Plus,
  Search,
  Settings,
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
import { EmptyState, ErrorState, InlineError, LoadingState } from '@/components/common/StateMessage';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useAuth } from '@/features/auth/use-auth';
import { useProjectPermissions } from '@/features/projects/hooks';
import { useBacklog } from '@/features/work-items/hooks';
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
import { PrStatusBadge, PullRequestDetailView } from '../components/PullRequestDetailView';

export function ReposPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const prParam = searchParams.get('pr');

  const { user } = useAuth();
  const { can } = useProjectPermissions(projectKey);

  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'pull_requests' | 'branches' | 'settings'>('pull_requests');
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
  const { data: pullRequests, isLoading: prsLoading, error: prsError } = usePullRequests(projectKey);

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
    <div className="grid h-full min-h-0 grid-cols-[300px_1fr] bg-surface">
      {/* Barre latérale des dépôts */}
      <aside className="border-border-default bg-surface-sunken flex min-h-0 flex-col border-r">
        <header className="border-border-subtle flex items-center justify-between border-b px-3 py-2.5">
          <div>
            <h1 className="text-ink-900 text-base font-bold">Dépôts Git</h1>
            <p className="text-ink-400 text-xs">{repositories?.length ?? 0} configuré(s)</p>
          </div>
          {can('repo:manage') && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setRepoDialogOpen(true)}
              title="Ajouter un dépôt"
            >
              <Plus className="size-3.5" />
              Dépôt
            </Button>
          )}
        </header>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
          {(repositories ?? []).length === 0 ? (
            <EmptyState
              title="Aucun dépôt"
              description="Ajoutez le dépôt Git de votre projet pour activer les branches et Pull Requests."
            />
          ) : (
            repositories?.map((repository) => (
              <button
                key={repository.id}
                type="button"
                onClick={() => setSelectedRepositoryId(repository.id)}
                className={cn(
                  'hover:bg-surface border-border-subtle group flex w-full flex-col gap-1 rounded-lg border p-2.5 text-left transition-all',
                  selectedRepository?.id === repository.id
                    ? 'bg-surface border-accent-400 shadow-sm ring-1 ring-accent-400'
                    : 'bg-surface/60',
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <GitBranch className="text-accent-600 size-4 shrink-0" />
                    <span className="text-ink-900 font-bold truncate text-sm">
                      {repository.name}
                    </span>
                  </div>
                  <span className="bg-surface-sunken text-ink-500 rounded px-1 text-[10px] font-semibold">
                    {repository.provider}
                  </span>
                </div>

                {repository.description && (
                  <p className="text-ink-500 line-clamp-1 text-xs">{repository.description}</p>
                )}

                <div className="mt-1 flex items-center justify-between text-[11px] text-ink-400">
                  <span>{repository.branchCount} branche(s)</span>
                  <span className="font-semibold text-accent-700 dark:text-accent-400">
                    {repository.pullRequestCount} PR(s)
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Contenu principal Dépôt sélectionné */}
      <main className="flex min-h-0 flex-col overflow-hidden bg-surface">
        {selectedRepository ? (
          <>
            {/* En-tête du dépôt sélectionné */}
            <header className="border-border-default bg-surface border-b px-5 py-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-ink-900 text-xl font-bold">{selectedRepository.name}</h2>
                    <span className="bg-surface-sunken text-ink-600 rounded px-2 py-0.5 text-xs font-semibold">
                      Branche par défaut : <span className="font-mono font-bold">{selectedRepository.defaultBranch}</span>
                    </span>
                  </div>
                  <p className="text-ink-500 truncate text-xs mt-0.5">{selectedRepository.url}</p>
                </div>

                <div className="flex items-center gap-2">
                  {can('branch:create') && (
                    <Button size="sm" onClick={() => setBranchDialogOpen(true)}>
                      <GitBranch className="size-3.5" />
                      Nouvelle Branche
                    </Button>
                  )}
                  {can('pr:declare') && (
                    <Button size="sm" variant="primary" onClick={() => setPrDialogOpen(true)}>
                      <GitPullRequest className="size-3.5" />
                      Créer Pull Request
                    </Button>
                  )}
                </div>
              </div>

              {/* Navigation des sous-onglets */}
              <nav className="mt-3 -mb-3 flex gap-4 border-t border-border-subtle pt-2">
                <button
                  type="button"
                  onClick={() => setMainTab('pull_requests')}
                  className={cn(
                    'flex items-center gap-1.5 border-b-2 py-2 text-xs font-bold transition-colors',
                    mainTab === 'pull_requests'
                      ? 'border-accent-600 text-accent-700 dark:text-accent-400'
                      : 'border-transparent text-ink-500 hover:text-ink-900',
                  )}
                >
                  <GitPullRequest className="size-3.5" />
                  Pull Requests ({selectedRepository.pullRequestCount})
                </button>

                <button
                  type="button"
                  onClick={() => setMainTab('branches')}
                  className={cn(
                    'flex items-center gap-1.5 border-b-2 py-2 text-xs font-bold transition-colors',
                    mainTab === 'branches'
                      ? 'border-accent-600 text-accent-700 dark:text-accent-400'
                      : 'border-transparent text-ink-500 hover:text-ink-900',
                  )}
                >
                  <GitBranch className="size-3.5" />
                  Branches ({selectedRepository.branchCount})
                </button>

                {can('repo:manage') && (
                  <button
                    type="button"
                    onClick={() => setMainTab('settings')}
                    className={cn(
                      'flex items-center gap-1.5 border-b-2 py-2 text-xs font-bold transition-colors',
                      mainTab === 'settings'
                        ? 'border-accent-600 text-accent-700 dark:text-accent-400'
                        : 'border-transparent text-ink-500 hover:text-ink-900',
                    )}
                  >
                    <Settings className="size-3.5" />
                    Paramètres
                  </button>
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
                          className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                            prStatusFilter === filter.id
                              ? 'bg-accent-600 text-white'
                              : 'bg-surface-sunken text-ink-600 hover:bg-surface-muted',
                          )}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative min-w-[220px]">
                      <Search className="text-ink-400 absolute left-2.5 top-2.5 size-3.5" />
                      <Input
                        value={prSearchQuery}
                        onChange={(e) => setPrSearchQuery(e.target.value)}
                        placeholder="Rechercher (#, titre, auteur)..."
                        className="pl-8 text-xs"
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
                    <div className="border-border-default divide-border-subtle divide-y overflow-hidden rounded-lg border bg-surface shadow-sm">
                      {filteredPullRequests.map((pr) => (
                        <div
                          key={pr.id}
                          onClick={() => handleSelectPr(pr.id)}
                          className="hover:bg-surface-muted/70 group flex cursor-pointer items-center justify-between gap-4 p-3.5 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="bg-surface-sunken border-border-subtle font-mono text-ink-800 dark:text-ink-200 rounded border px-1.5 py-0.5 text-xs font-bold">
                                #{pr.number}
                              </span>
                              <span className="text-ink-900 group-hover:text-accent-700 font-bold truncate text-sm">
                                {pr.title}
                              </span>
                              <PrStatusBadge status={pr.status} />
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                              <span className="bg-surface-sunken rounded px-1.5 py-0.2 font-mono font-semibold text-ink-700 dark:text-ink-300">
                                {pr.workItem.key}
                              </span>
                              <span>·</span>
                              <span className="font-mono text-ink-700 dark:text-ink-300">
                                {pr.sourceBranch.name} → {pr.targetBranch?.name ?? pr.targetBranchName ?? 'main'}
                              </span>
                              <span>·</span>
                              <span>
                                Ouverte par <span className="font-semibold text-ink-800 dark:text-ink-200">{pr.declaredBy.name}</span>
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-1">
                                <Clock className="size-3" />
                                {new Date(pr.createdAt).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {pr.reviewedBy && (
                              <span className="text-ink-400 text-xs hidden sm:inline">
                                Revue : {pr.reviewedBy.name}
                              </span>
                            )}
                            <ArrowRight className="text-ink-400 group-hover:text-ink-900 size-4 transition-transform group-hover:translate-x-0.5" />
                          </div>
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
                    <div className="border-border-default divide-border-subtle divide-y overflow-hidden rounded-lg border bg-surface shadow-sm">
                      <div className="bg-surface-muted grid grid-cols-[1fr_120px_180px_100px] gap-2 px-4 py-2 text-xs font-bold text-ink-600">
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
                            className="grid grid-cols-[1fr_120px_180px_100px] items-center gap-2 px-4 py-2.5 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <GitBranch className="text-accent-600 size-4 shrink-0" />
                              <span className="font-mono font-bold text-ink-900 dark:text-ink-100 truncate">
                                {branch.name}
                              </span>
                              {isDefault && (
                                <span className="bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-300 rounded px-1.5 py-0.2 text-[10px] font-bold">
                                  Défaut
                                </span>
                              )}
                              {branch.isProtected && (
                                <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[10px] font-bold">
                                  <Shield className="size-2.5" />
                                  Protégée
                                </span>
                              )}
                            </div>

                            <div>
                              {branch.isLocalOnly ? (
                                <span className="bg-amber-50 text-amber-800 border-amber-200 rounded border px-1.5 py-0.5 text-[10px] font-semibold">
                                  Locale
                                </span>
                              ) : (
                                <span className="text-ink-500 text-xs">Distante</span>
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
          </>
        ) : (
          <EmptyState
            title="Aucun dépôt sélectionné"
            description="Sélectionnez un dépôt dans le panneau latéral ou ajoutez-en un nouveau."
          />
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
    if (confirm(`Êtes-vous certain de vouloir supprimer définitivement le dépôt ${repository.name} ?`)) {
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
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
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
                <option key={value} value={value}>{value}</option>
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
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
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
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
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
                <option key={b.id} value={b.id}>{b.name}</option>
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
