import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  GitBranch,
  GitMerge,
  GitPullRequest,
  MessageSquare,
  Send,
  Shield,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import { LABELS_FR, PullRequestStatus, type PullRequestDetail } from '@visiora/shared';
import { MarkdownEditor } from '@/components/common/MarkdownEditor';
import { MarkdownViewer } from '@/components/common/MarkdownViewer';
import { safeHttpUrl } from '@/lib/security';
import { EmptyState, InlineError } from '@/components/common/StateMessage';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';
import { useProjectPermissions } from '@/features/projects/hooks';
import { cn } from '@/lib/utils';
import {
  useAddPullRequestComment,
  useApprovePullRequest,
  useClosePullRequest,
  useMarkPullRequestReady,
  useMergePullRequest,
  useRejectPullRequest,
  useRequestChangesPullRequest,
} from '../hooks';
import { RejectPullRequestDialog } from './RejectPullRequestDialog';
import { RequestChangesDialog } from './RequestChangesDialog';

export function PullRequestDetailView({
  projectRef,
  pullRequest,
  onBack,
}: {
  projectRef: string;
  pullRequest: PullRequestDetail;
  onBack?: () => void;
}) {
  const { user } = useAuth();
  const { can } = useProjectPermissions(projectRef);
  const externalUrl = pullRequest.externalUrl ? safeHttpUrl(pullRequest.externalUrl) : null;

  const [activeTab, setActiveTab] = useState<'overview' | 'discussion' | 'activity'>('overview');
  const [commentDraft, setCommentDraft] = useState('');
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const markReady = useMarkPullRequestReady(projectRef);
  const approve = useApprovePullRequest(projectRef);
  const requestChanges = useRequestChangesPullRequest(projectRef);
  const reject = useRejectPullRequest(projectRef);
  const merge = useMergePullRequest(projectRef);
  const close = useClosePullRequest(projectRef);
  const addComment = useAddPullRequestComment(projectRef);

  const isAuthor = user?.id === pullRequest.declaredBy.id;
  const canReview = can('pr:review') || can('pr:approve');
  const canMerge = can('pr:merge');
  const canClose = can('pr:close') || isAuthor;

  // Interdiction d'auto-approbation sur branches cibles protégées
  const isTargetProtected = pullRequest.targetBranch?.isProtected ?? true;
  const isSelfApprovalBlocked = isAuthor && isTargetProtected;

  const handleApprove = async () => {
    setActionError(null);
    try {
      await approve.mutateAsync({ pullRequestId: pullRequest.id });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Erreur lors de l'approbation");
    }
  };

  const handleRequestChanges = async (reason: string) => {
    setActionError(null);
    try {
      await requestChanges.mutateAsync({ pullRequestId: pullRequest.id, comment: reason });
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : 'Erreur lors de la demande de modifications',
      );
    }
  };

  const handleReject = async (reason: string) => {
    setActionError(null);
    try {
      await reject.mutateAsync({ pullRequestId: pullRequest.id, rejectionReason: reason });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Erreur lors du rejet');
    }
  };

  const handleMerge = async () => {
    setActionError(null);
    try {
      await merge.mutateAsync(pullRequest.id);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Erreur lors de la fusion');
    }
  };

  const handleClose = async () => {
    setActionError(null);
    try {
      await close.mutateAsync(pullRequest.id);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Erreur lors de la fermeture');
    }
  };

  const handleAddComment = async () => {
    if (!commentDraft.trim()) return;
    setActionError(null);
    try {
      await addComment.mutateAsync({
        pullRequestId: pullRequest.id,
        input: { body: commentDraft.trim() },
      });
      setCommentDraft('');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Erreur lors de l'ajout du commentaire");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* En-tête Azure DevOps */}
      <header className="border-border-default bg-surface border-b px-6 pt-5 pb-4">
        <div className="flex flex-col gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-ink-500 hover:text-ink-900 flex w-fit items-center gap-1 text-xs font-semibold"
            >
              <ArrowLeft className="size-3.5" />
              Retour à la liste des Pull Requests
            </button>
          )}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-surface-sunken text-ink-600 rounded-md px-2 py-0.5 font-mono text-xs font-semibold">
                  PR #{pullRequest.number}
                </span>
                <h1 className="text-ink-900 text-2xl font-bold tracking-tight">
                  {pullRequest.title}
                </h1>
                <PrStatusBadge status={pullRequest.status} />
              </div>

              {/* Flux de branches */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-ink-500">Dépôt :</span>
                <span className="font-semibold text-ink-700">{pullRequest.repository.name}</span>

                <span className="text-ink-400">·</span>

                <div className="bg-surface-muted border-border-subtle flex items-center gap-1.5 rounded-md border px-2 py-0.5">
                  <GitBranch className="text-accent-600 size-3.5" />
                  <span className="font-mono font-semibold text-ink-900">
                    {pullRequest.sourceBranch.name}
                  </span>
                </div>

                <ArrowRight className="text-ink-400 size-3.5" />

                <div className="bg-surface-muted border-border-subtle flex items-center gap-1.5 rounded-md border px-2 py-0.5">
                  <GitBranch className="text-ink-600 size-3.5" />
                  <span className="font-mono font-semibold text-ink-900">
                    {pullRequest.targetBranch?.name ?? pullRequest.targetBranchName ?? 'main'}
                  </span>
                  {pullRequest.targetBranch?.isProtected && (
                    <span
                      title="Branche protégée"
                      className="bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-300 flex items-center gap-0.5 rounded px-1 text-[10px] font-bold"
                    >
                      <Shield className="size-2.5" />
                      Protégée
                    </span>
                  )}
                </div>

                {externalUrl && (
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent-600 hover:text-accent-800 inline-flex items-center gap-1 font-semibold"
                  >
                    <span>Lien Git externe</span>
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Barre d'actions réviseur & fusion */}
            <div className="flex flex-wrap items-center gap-1.5">
              {pullRequest.status === PullRequestStatus.OPEN && isAuthor && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => markReady.mutate(pullRequest.id)}
                  loading={markReady.isPending}
                >
                  <Send className="size-3.5" />
                  Demander révision
                </Button>
              )}

              {canReview &&
                (pullRequest.status === PullRequestStatus.READY_FOR_APPROVAL ||
                  pullRequest.status === PullRequestStatus.OPEN) && (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={handleApprove}
                      loading={approve.isPending}
                      disabled={isSelfApprovalBlocked}
                      title={
                        isSelfApprovalBlocked
                          ? 'Auto-approbation interdite sur branche protégée'
                          : 'Valider et approuver cette PR'
                      }
                    >
                      <ThumbsUp className="size-3.5" />
                      Approuver
                    </Button>

                    <Button
                      size="sm"
                      variant="secondary"
                      className="border-amber-400 text-amber-800 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                      onClick={() => setRequestChangesOpen(true)}
                    >
                      <ThumbsDown className="size-3.5" />
                      Demander modifs
                    </Button>

                    <Button size="sm" variant="danger" onClick={() => setRejectOpen(true)}>
                      <XCircle className="size-3.5" />
                      Rejeter
                    </Button>
                  </>
                )}

              {canMerge && pullRequest.status === PullRequestStatus.APPROVED && (
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleMerge}
                  loading={merge.isPending}
                >
                  <GitMerge className="size-3.5" />
                  Fusionner la PR (Merge)
                </Button>
              )}

              {canClose &&
                pullRequest.status !== PullRequestStatus.MERGED &&
                pullRequest.status !== PullRequestStatus.CLOSED && (
                  <Button size="sm" variant="ghost" onClick={handleClose} loading={close.isPending}>
                    Fermer la PR
                  </Button>
                )}
            </div>
          </div>

          {isSelfApprovalBlocked &&
            (pullRequest.status === PullRequestStatus.READY_FOR_APPROVAL ||
              pullRequest.status === PullRequestStatus.OPEN) && (
              <div className="bg-accent-50 dark:bg-accent-950/40 border-accent-200 dark:border-accent-800 flex items-center gap-2 rounded border px-3 py-1.5 text-xs">
                <Shield className="text-accent-700 size-4 shrink-0" />
                <span className="text-ink-700 ">
                  Politique de branche protégée : en tant qu'auteur, vous ne pouvez pas approuver
                  votre propre Pull Request. Un autre réviseur ou PO doit valider vos modifications.
                </span>
              </div>
            )}

          {actionError && <InlineError error={new Error(actionError)} />}

          {/* Métadonnées auteur et ticket */}
          <div className="border-border-subtle flex flex-wrap items-center gap-4 border-t pt-2 text-xs text-ink-500">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold">Auteur :</span>
              <span className="text-ink-700 font-medium">{pullRequest.declaredBy.name}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold">Ticket associé :</span>
              <span className="bg-surface-sunken rounded px-1.5 py-0.5 font-semibold text-ink-900">
                {pullRequest.workItem.key} · {pullRequest.workItem.title}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Clock className="size-3 text-ink-400" />
              <span>Créée le {new Date(pullRequest.createdAt).toLocaleString('fr-FR')}</span>
            </div>

            {pullRequest.reviewedBy && pullRequest.reviewedAt && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3 text-emerald-600" />
                <span>
                  Revue par {pullRequest.reviewedBy.name} le{' '}
                  {new Date(pullRequest.reviewedAt).toLocaleString('fr-FR')}
                </span>
              </div>
            )}

            {pullRequest.mergedBy && pullRequest.mergedAt && (
              <div className="flex items-center gap-1.5">
                <GitMerge className="size-3 text-accent-600" />
                <span>
                  Fusionnée par {pullRequest.mergedBy.name} le{' '}
                  {new Date(pullRequest.mergedAt).toLocaleString('fr-FR')}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation des Onglets */}
      <nav className="border-border-default bg-surface flex gap-4 border-b px-6">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
            activeTab === 'overview'
              ? 'border-accent-600 text-accent-700 dark:text-accent-400'
              : 'border-transparent text-ink-500 hover:text-ink-900',
          )}
        >
          <GitPullRequest className="size-4" />
          Vue d'ensemble & Spécifications
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('discussion')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
            activeTab === 'discussion'
              ? 'border-accent-600 text-accent-700 dark:text-accent-400'
              : 'border-transparent text-ink-500 hover:text-ink-900',
          )}
        >
          <MessageSquare className="size-4" />
          Discussion
          <span className="bg-surface-sunken text-ink-600 rounded-full px-1.5 py-0.2 text-xs">
            {pullRequest.comments.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          className={cn(
            'flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition-colors',
            activeTab === 'activity'
              ? 'border-accent-600 text-accent-700 dark:text-accent-400'
              : 'border-transparent text-ink-500 hover:text-ink-900',
          )}
        >
          <Clock className="size-4" />
          Historique d'activité
          <span className="bg-surface-sunken text-ink-600 rounded-full px-1.5 py-0.2 text-xs">
            {pullRequest.events.length}
          </span>
        </button>
      </nav>

      {/* Contenu de l'onglet actif */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <div className="mx-auto flex max-w-4xl flex-col gap-6">
            {/* Bannière Rejet ou Demande de modifs si présente */}
            {pullRequest.status === PullRequestStatus.CHANGES_REQUESTED && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 rounded-xl border p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-5 text-amber-600 shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-amber-900 dark:text-amber-200 text-sm font-bold">
                      Modifications requises par le réviseur ({pullRequest.reviewedBy?.name})
                    </h3>
                    <p className="text-ink-700 mt-1 whitespace-pre-wrap text-sm">
                      {pullRequest.reviewComment ?? 'Veuillez réviser le code avant réapprobation.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {pullRequest.status === PullRequestStatus.REJECTED && (
              <div className="bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 rounded-xl border p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 size-5 text-danger shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-danger text-sm font-bold">
                      Pull Request Rejetée définitivement par {pullRequest.reviewedBy?.name}
                    </h3>
                    <p className="text-ink-700 mt-1 whitespace-pre-wrap text-sm">
                      {pullRequest.rejectionReason ?? 'Cette proposition a été rejetée.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Description Markdown de la PR */}
            <section className="card p-5">
              <h2 className="text-ink-900 mb-3 text-base font-bold">
                Description de la Pull Request
              </h2>
              {pullRequest.description ? (
                <MarkdownViewer content={pullRequest.description} />
              ) : (
                <p className="text-ink-400 text-sm italic">
                  Aucune description fournie pour cette PR.
                </p>
              )}
            </section>

            {/* Résumé du Ticket lié */}
            <section className="card p-5">
              <h2 className="text-ink-900 mb-2 text-base font-bold">Contexte Ticket</h2>
              <div className="bg-surface-muted border-border-subtle rounded border p-3">
                <div className="flex items-center gap-2">
                  <span className="bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-300 rounded px-1.5 py-0.5 font-mono text-xs font-bold">
                    {pullRequest.workItem.key}
                  </span>
                  <span className="text-ink-900 text-sm font-semibold">
                    {pullRequest.workItem.title}
                  </span>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'discussion' && (
          <div className="mx-auto flex max-w-4xl flex-col gap-5">
            {/* Liste des commentaires */}
            {pullRequest.comments.length === 0 ? (
              <EmptyState
                title="Aucune discussion"
                description="Posez une question ou partagez une remarque avec l’auteur et les réviseurs."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {pullRequest.comments.map((comment) => (
                  <div key={comment.id} className="card p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="bg-accent-600 flex size-6 items-center justify-center rounded-full text-xs font-bold text-white">
                          {comment.author.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-ink-900 text-sm font-semibold">
                          {comment.author.name}
                        </span>
                        <span className="text-ink-400 text-xs">
                          {new Date(comment.createdAt).toLocaleString('fr-FR')}
                        </span>
                      </div>
                    </div>
                    <div className="text-ink-700 text-sm">
                      <MarkdownViewer content={comment.body} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Formulaire d'ajout de commentaire */}
            <div className="border-border-default bg-surface mt-2 rounded-xl border p-4">
              <h3 className="text-ink-900 mb-2 text-sm font-semibold">Ajouter un commentaire</h3>
              <MarkdownEditor
                value={commentDraft}
                onChange={setCommentDraft}
                minHeight="100px"
                placeholder="Rédiger un commentaire (Markdown supporté, coller une capture d’écran Ctrl+V)..."
              />
              <div className="mt-3 flex justify-end">
                <Button
                  variant="primary"
                  onClick={handleAddComment}
                  disabled={!commentDraft.trim()}
                  loading={addComment.isPending}
                >
                  <Send className="size-3.5" />
                  Commenter
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="mx-auto flex max-w-4xl flex-col gap-4">
            <h2 className="text-ink-900 text-base font-bold">Chronologie d'Audit & Activité</h2>
            <div className="relative border-l-2 border-border-default ml-4 pl-6 space-y-6">
              {pullRequest.events.map((event) => (
                <div key={event.id} className="relative">
                  <div className="absolute -left-[31px] top-0.5 size-4 rounded-full bg-surface border-2 border-accent-600" />
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-ink-900">
                        {event.actor?.name ?? 'Système'}
                      </span>
                      <span className="text-ink-400">·</span>
                      <span className="text-ink-400">
                        {new Date(event.createdAt).toLocaleString('fr-FR')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span>Passage à l'état</span>
                      <PrStatusBadge status={event.toStatus} />
                    </div>

                    {event.comment && (
                      <div className="bg-surface-muted border-border-subtle mt-1 rounded border p-2.5 text-xs text-ink-700  whitespace-pre-wrap">
                        {event.comment}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals de révision */}
      <RequestChangesDialog
        open={requestChangesOpen}
        onClose={() => setRequestChangesOpen(false)}
        onSubmit={handleRequestChanges}
        loading={requestChanges.isPending}
      />

      <RejectPullRequestDialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onSubmit={handleReject}
        loading={reject.isPending}
      />
    </div>
  );
}

/** Teintes des statuts de PR : pastille et tuile d'icône des listes. */
const PR_STATUS_STYLE: Record<PullRequestStatus, { badge: string; dot: string; tile: string }> = {
  [PullRequestStatus.OPEN]: {
    badge: 'bg-surface-sunken text-ink-700',
    dot: 'bg-ink-400',
    tile: 'bg-surface-sunken text-ink-600',
  },
  [PullRequestStatus.READY_FOR_APPROVAL]: {
    badge: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    dot: 'bg-amber-500',
    tile: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50',
  },
  [PullRequestStatus.APPROVED]: {
    badge: 'bg-green-50 text-success dark:bg-green-950/50',
    dot: 'bg-success',
    tile: 'bg-green-50 text-success dark:bg-green-950/50',
  },
  [PullRequestStatus.CHANGES_REQUESTED]: {
    badge: 'bg-red-50 text-danger dark:bg-red-950/50',
    dot: 'bg-danger',
    tile: 'bg-red-50 text-danger dark:bg-red-950/50',
  },
  [PullRequestStatus.REJECTED]: {
    badge: 'bg-danger text-white',
    dot: 'bg-white',
    tile: 'bg-red-100 text-danger dark:bg-red-950/60',
  },
  [PullRequestStatus.MERGED]: {
    badge: 'bg-purple-50 text-purple dark:bg-purple-950/50 dark:text-purple-300',
    dot: 'bg-purple',
    tile: 'bg-purple-50 text-purple dark:bg-purple-950/50 dark:text-purple-300',
  },
  [PullRequestStatus.CLOSED]: {
    badge: 'bg-surface-sunken text-ink-500',
    dot: 'bg-ink-400',
    tile: 'bg-surface-sunken text-ink-400',
  },
};

export function PrStatusBadge({ status }: { status: PullRequestStatus }) {
  const style = PR_STATUS_STYLE[status];
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        style.badge,
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', style.dot)} />
      {LABELS_FR.pullRequestStatus[status] ?? status}
    </span>
  );
}

/** Tuile carrée teintée selon le statut, en tête de chaque ligne de PR. */
export function PrStatusIcon({ status }: { status: PullRequestStatus }) {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-lg',
        PR_STATUS_STYLE[status].tile,
      )}
    >
      <GitPullRequest className="size-4" strokeWidth={1.75} />
    </span>
  );
}
