import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { InlineError, LoadingState } from '@/components/common/StateMessage';
import { projectsApi } from '../api';
import { useDeleteProjectDocument, useProjectDocuments, useUploadProjectDocument } from '../hooks';

interface ProjectDocumentsPanelProps {
  projectRef: string;
  canManage: boolean;
}

export function ProjectDocumentsPanel({ projectRef, canManage }: ProjectDocumentsPanelProps) {
  const { data: documents, isLoading } = useProjectDocuments(projectRef);
  const upload = useUploadProjectDocument(projectRef);
  const remove = useDeleteProjectDocument(projectRef);
  const [error, setError] = useState<unknown>(null);

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;

    setError(null);
    try {
      for (const file of files) await upload.mutateAsync(file);
    } catch (uploadError) {
      setError(uploadError);
    } finally {
      input.value = '';
    }
  };

  const download = async (documentId: string, fileName: string) => {
    setError(null);
    try {
      const blob = await projectsApi.downloadDocument(projectRef, documentId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError);
    }
  };

  const removeDocument = async (documentId: string, fileName: string) => {
    if (!window.confirm(`Supprimer le document « ${fileName} » ?`)) return;
    setError(null);
    try {
      await remove.mutateAsync(documentId);
    } catch (removeError) {
      setError(removeError);
    }
  };

  return (
    <section className="border-border-default bg-surface rounded border">
      <header className="border-border-subtle flex items-center gap-2 border-b px-3 py-2">
        <FileText className="text-ink-500 size-4" strokeWidth={1.75} />
        <h2 className="text-ink-900 text-lg font-semibold">Documents du projet</h2>
        <span className="text-ink-400 text-sm">{documents?.length ?? 0}</span>
        {canManage && (
          <label className="text-accent-700 hover:bg-accent-50 ml-auto flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-sm font-semibold">
            <Upload className="size-3.5" strokeWidth={1.75} />
            Ajouter des PDF
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="sr-only"
              disabled={upload.isPending}
              onChange={(event) => void uploadFiles(event)}
            />
          </label>
        )}
      </header>

      {isLoading ? (
        <LoadingState label="Chargement des documents…" />
      ) : (
        <div className="divide-border-subtle divide-y">
          {(documents ?? []).length === 0 && (
            <p className="text-ink-400 px-3 py-5 text-center text-sm">
              Aucun document PDF joint au projet.
            </p>
          )}
          {(documents ?? []).map((document) => (
            <div key={document.id} className="flex items-center gap-2 px-3 py-2">
              <FileText className="text-danger size-4 shrink-0" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="text-ink-900 truncate text-sm font-semibold">{document.fileName}</p>
                <p className="text-ink-400 text-xs">
                  {formatSize(document.sizeBytes)} · ajouté par {document.uploadedBy.name} ·{' '}
                  {new Date(document.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Télécharger ${document.fileName}`}
                onClick={() => void download(document.id, document.fileName)}
              >
                <Download className="size-3.5" strokeWidth={1.75} />
              </Button>
              {canManage && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Supprimer ${document.fileName}`}
                  disabled={remove.isPending}
                  onClick={() => void removeDocument(document.id, document.fileName)}
                >
                  <Trash2 className="text-danger size-3.5" strokeWidth={1.75} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {Boolean(error) && (
        <div className="px-3 py-2">
          <InlineError error={error} />
        </div>
      )}
    </section>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
