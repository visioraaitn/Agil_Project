import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GitBranch, GitPullRequest, Plus, ThumbsDown, ThumbsUp } from 'lucide-react';
import {
  GitProvider,
  LABELS_FR,
  PullRequestStatus,
  WorkItemType,
  type BacklogNode,
  type BranchSummary,
  type PullRequestSummary,
  type RepositorySummary,
} from '@visiora/shared';
import { EmptyState, ErrorState, InlineError, LoadingState } from '@/components/common/StateMessage';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useProjectPermissions } from '@/features/projects/hooks';
import { useBacklog } from '@/features/work-items/hooks';
import { cn } from '@/lib/utils';
import {
  useBranches,
  useCreateBranch,
  useCreatePullRequest,
  useCreateRepository,
  useMarkPullRequestReady,
  usePullRequests,
  useRepositories,
  useReviewPullRequest,
} from '../hooks';

export function ReposPage() {
  const { projectKey = '' } = useParams<{ projectKey: string }>();
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<string | null>(null);
  const [repoDialogOpen, setRepoDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [prDialogOpen, setPrDialogOpen] = useState(false);

  const { data: repositories, isLoading, error } = useRepositories(projectKey);
  const selectedRepository =
    repositories?.find((repository) => repository.id === selectedRepositoryId) ??
    repositories?.[0] ??
    null;
  const { data: branches } = useBranches(projectKey, selectedRepository?.id ?? null);
  const { data: pullRequests, isLoading: prsLoading, error: prsError } = usePullRequests(projectKey);
  const { can } = useProjectPermissions(projectKey);

  useEffect(() => {
    if (!selectedRepositoryId && repositories?.[0]) setSelectedRepositoryId(repositories[0].id);
  }, [repositories, selectedRepositoryId]);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="grid h-full min-h-0 grid-cols-[340px_1fr]">
      <aside className="border-border-default flex min-h-0 flex-col border-r">
        <header className="border-border-subtle flex items-center gap-2 border-b px-3 py-2">
          <h1 className="text-ink-900 text-xl font-semibold">Repos & PR</h1>
          {can('repo:manage') && (
            <Button size="sm" variant="primary" className="ml-auto" onClick={() => setRepoDialogOpen(true)}>
              <Plus className="size-3.5" strokeWidth={2.5} />
              Depot
            </Button>
          )}
        </header>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          {(repositories ?? []).length === 0 ? (
            <EmptyState title="Aucun depot" description="Referencez le depot Git externe du projet." />
          ) : (
            repositories?.map((repository) => (
              <button
                key={repository.id}
                type="button"
                onClick={() => setSelectedRepositoryId(repository.id)}
                className={cn(
                  'border-border-subtle hover:bg-surface-muted flex w-full flex-col gap-1 border-b px-3 py-2 text-left',
                  selectedRepository?.id === repository.id && 'bg-accent-50',
                )}
              >
                <span className="flex items-center gap-2">
                  <GitBranch className="text-ink-400 size-4" strokeWidth={1.75} />
                  <span className="text-ink-900 min-w-0 flex-1 truncate text-base font-semibold">
                    {repository.name}
                  </span>
                  <span className="text-ink-400 text-xs">{repository.provider}</span>
                </span>
                <span className="text-ink-400 truncate text-xs">{repository.url}</span>
                <span className="text-ink-500 text-xs">
                  {repository.branchCount} branche(s) · {repository.pullRequestCount} PR
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="min-h-0 overflow-y-auto p-4">
        <section className="border-border-subtle mb-4 border-b pb-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-ink-900 text-2xl font-semibold">
                {selectedRepository?.name ?? 'Depot Git'}
              </h2>
              <p className="text-ink-500 truncate text-base">
                {selectedRepository?.url ?? 'Aucun depot selectionne'}
              </p>
            </div>
            {selectedRepository && can('repo:manage') && (
              <Button onClick={() => setBranchDialogOpen(true)}>
                <GitBranch className="size-3.5" strokeWidth={2} />
                Branche
              </Button>
            )}
            {selectedRepository && can('pr:declare') && (
              <Button variant="primary" onClick={() => setPrDialogOpen(true)}>
                <GitPullRequest className="size-3.5" strokeWidth={2} />
                Declarer PR
              </Button>
            )}
          </div>
        </section>

        <section className="mb-4">
          <h3 className="text-ink-900 mb-2 text-lg font-semibold">Branches</h3>
          {!selectedRepository ? (
            <EmptyState title="Aucun depot selectionne" />
          ) : (branches ?? []).length === 0 ? (
            <EmptyState title="Aucune branche" />
          ) : (
            <div className="border-border-default overflow-hidden rounded border">
              {branches?.map((branch) => (
                <div
                  key={branch.id}
                  className="border-border-subtle flex items-center gap-2 border-b px-3 py-1.5 last:border-b-0"
                >
                  <GitBranch className="text-ink-400 size-3.5" strokeWidth={1.75} />
                  <span className="text-ink-900 flex-1 truncate text-base">{branch.name}</span>
                  {branch.isLocalOnly && (
                    <span className="bg-yellow-50 text-yellow-800 rounded px-1.5 py-0.5 text-xs font-semibold">
                      locale
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-ink-900 mb-2 text-lg font-semibold">Pull requests</h3>
          {prsLoading ? (
            <LoadingState />
          ) : prsError ? (
            <ErrorState error={prsError} />
          ) : (pullRequests ?? []).length === 0 ? (
            <EmptyState title="Aucune PR declaree" />
          ) : (
            <div className="border-border-default overflow-hidden rounded border">
              {pullRequests?.map((pullRequest) => (
                <PullRequestRow
                  key={pullRequest.id}
                  projectRef={projectKey}
                  pullRequest={pullRequest}
                  canDeclare={can('pr:declare')}
                  canApprove={can('pr:approve')}
                />
              ))}
            </div>
          )}
        </section>
      </main>

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
          />
        </>
      )}
    </div>
  );
}

function PullRequestRow({
  projectRef,
  pullRequest,
  canDeclare,
  canApprove,
}: {
  projectRef: string;
  pullRequest: PullRequestSummary;
  canDeclare: boolean;
  canApprove: boolean;
}) {
  const ready = useMarkPullRequestReady(projectRef);
  const review = useReviewPullRequest(projectRef);

  return (
    <div className="border-border-subtle grid grid-cols-[1fr_150px_210px] items-center gap-3 border-b px-3 py-2 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <GitPullRequest className="text-ink-400 size-4" strokeWidth={1.75} />
          <span className="text-ink-900 truncate text-base font-semibold">{pullRequest.title}</span>
          {pullRequest.externalNumber && (
            <span className="text-ink-400 text-xs">#{pullRequest.externalNumber}</span>
          )}
        </div>
        <p className="text-ink-500 truncate text-sm">
          {pullRequest.workItem.key} · {pullRequest.sourceBranch.name} -{' '}
          {pullRequest.targetBranch?.name ?? pullRequest.targetBranchName ?? 'branche cible'}
        </p>
      </div>
      <PrStatus status={pullRequest.status} />
      <div className="flex justify-end gap-1">
        {canDeclare && pullRequest.status === PullRequestStatus.OPEN && (
          <Button size="sm" onClick={() => ready.mutate(pullRequest.id)} loading={ready.isPending}>
            Prete
          </Button>
        )}
        {canApprove && pullRequest.status === PullRequestStatus.READY_FOR_APPROVAL && (
          <>
            <Button
              size="sm"
              onClick={() =>
                review.mutate({
                  pullRequestId: pullRequest.id,
                  input: { status: PullRequestStatus.APPROVED },
                })
              }
              loading={review.isPending}
              aria-label="Approuver"
            >
              <ThumbsUp className="size-3.5" strokeWidth={2} />
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() =>
                review.mutate({
                  pullRequestId: pullRequest.id,
                  input: { status: PullRequestStatus.CHANGES_REQUESTED, comment: 'A reprendre' },
                })
              }
              loading={review.isPending}
              aria-label="Rejeter"
            >
              <ThumbsDown className="size-3.5" strokeWidth={2} />
            </Button>
          </>
        )}
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
  const [url, setUrl] = useState('');
  const [provider, setProvider] = useState<GitProvider>(GitProvider.GITHUB);
  const [defaultBranch, setDefaultBranch] = useState('main');

  const submit = async () => {
    const repository = await createRepository.mutateAsync({ name, url, provider, defaultBranch });
    onCreated(repository.id);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Referencer un depot"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={submit} loading={createRepository.isPending}>
            Creer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <InlineError error={createRepository.error} />
        <Field label="Nom" htmlFor="repo-name" required>
          <Input id="repo-name" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="URL" htmlFor="repo-url" required>
          <Input id="repo-url" value={url} onChange={(event) => setUrl(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Provider" htmlFor="repo-provider">
            <Select
              id="repo-provider"
              value={provider}
              onChange={(event) => setProvider(event.target.value as GitProvider)}
            >
              {Object.values(GitProvider).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </Field>
          <Field label="Branche par defaut" htmlFor="repo-default-branch">
            <Input
              id="repo-default-branch"
              value={defaultBranch}
              onChange={(event) => setDefaultBranch(event.target.value)}
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

  const submit = async () => {
    await createBranch.mutateAsync({ name, isLocalOnly: true });
    setName('');
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Nouvelle branche locale"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={submit} loading={createBranch.isPending}>
            Creer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <InlineError error={createBranch.error} />
        <Field label="Nom" htmlFor="branch-name" required>
          <Input
            id="branch-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="feature/ma-fonctionnalite"
          />
        </Field>
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
}: {
  projectRef: string;
  repository: RepositorySummary;
  branches: BranchSummary[];
  open: boolean;
  onClose: () => void;
}) {
  const createPullRequest = useCreatePullRequest(projectRef);
  const { data: backlog } = useBacklog(projectRef, {});
  const workItems = useMemo(
    () => flattenBacklog(backlog ?? []).filter((item) => item.type !== WorkItemType.EPIC),
    [backlog],
  );
  const [title, setTitle] = useState('');
  const [workItemId, setWorkItemId] = useState('');
  const [sourceBranchId, setSourceBranchId] = useState('');
  const [targetBranchId, setTargetBranchId] = useState('');
  const [externalUrl, setExternalUrl] = useState('');

  const submit = async () => {
    await createPullRequest.mutateAsync({
      repositoryId: repository.id,
      workItemId,
      title,
      sourceBranchId,
      targetBranchId: targetBranchId || null,
      externalUrl: externalUrl || null,
    });
    setTitle('');
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Declarer une pull request"
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={submit} loading={createPullRequest.isPending}>
            Declarer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <InlineError error={createPullRequest.error} />
        <Field label="Ticket" htmlFor="pr-work-item" required>
          <Select
            id="pr-work-item"
            value={workItemId}
            onChange={(event) => setWorkItemId(event.target.value)}
          >
            <option value="">Choisir un ticket</option>
            {workItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.key} · {item.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Titre" htmlFor="pr-title" required>
          <Input id="pr-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source" htmlFor="pr-source" required>
            <Select
              id="pr-source"
              value={sourceBranchId}
              onChange={(event) => setSourceBranchId(event.target.value)}
            >
              <option value="">Branche source</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Cible" htmlFor="pr-target">
            <Select
              id="pr-target"
              value={targetBranchId}
              onChange={(event) => setTargetBranchId(event.target.value)}
            >
              <option value="">Branche cible</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="URL externe" htmlFor="pr-url">
          <Input id="pr-url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function PrStatus({ status }: { status: PullRequestStatus }) {
  const tone = {
    [PullRequestStatus.OPEN]: 'bg-surface-sunken text-ink-700',
    [PullRequestStatus.READY_FOR_APPROVAL]: 'bg-yellow-50 text-yellow-800',
    [PullRequestStatus.APPROVED]: 'bg-green-50 text-green-700',
    [PullRequestStatus.CHANGES_REQUESTED]: 'bg-red-50 text-danger',
    [PullRequestStatus.MERGED]: 'bg-accent-50 text-accent-700',
    [PullRequestStatus.CLOSED]: 'bg-surface-sunken text-ink-400',
  }[status];
  return (
    <span className={cn('w-fit rounded px-1.5 py-0.5 text-xs font-semibold', tone)}>
      {LABELS_FR.pullRequestStatus[status]}
    </span>
  );
}

function flattenBacklog(nodes: BacklogNode[]): BacklogNode[] {
  return nodes.flatMap((node) => [node, ...flattenBacklog(node.children)]);
}
