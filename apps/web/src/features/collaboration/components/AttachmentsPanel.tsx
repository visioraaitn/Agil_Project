import { Download, Paperclip, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InlineError } from '@/components/common/StateMessage';
import { collaborationApi } from '../api';
import { useAttachments, useDeleteAttachment, useUploadAttachment } from '../hooks';

interface AttachmentsPanelProps {
  projectRef: string;
  itemId: string;
  canManage: boolean;
}

export function AttachmentsPanel({ projectRef, itemId, canManage }: AttachmentsPanelProps) {
  const { data: attachments } = useAttachments(projectRef, itemId);
  const upload = useUploadAttachment(projectRef, itemId);
  const remove = useDeleteAttachment(projectRef, itemId);
  const [error, setError] = useState<unknown>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      await upload.mutateAsync(file);
    } catch (uploadError) {
      setError(uploadError);
    }
  };

  const download = async (attachmentId: string, fileName: string) => {
    setError(null);
    try {
      const blob = await collaborationApi.downloadAttachment(projectRef, itemId, attachmentId);
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

  return (
    <section className="border-border-subtle rounded border">
      <header className="border-border-subtle flex items-center gap-2 border-b px-2 py-1.5">
        <Paperclip className="text-ink-500 size-4" strokeWidth={1.75} />
        <h3 className="text-ink-700 text-sm font-semibold">Pieces jointes</h3>
        <span className="text-ink-400 text-xs">{attachments?.length ?? 0}</span>
        {canManage && (
          <label className="text-accent-700 hover:bg-accent-50 ml-auto flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-sm font-semibold">
            <Upload className="size-3.5" strokeWidth={1.75} />
            Ajouter
            <input
              type="file"
              className="sr-only"
              onChange={(event) => void onFile(event.target.files?.[0])}
            />
          </label>
        )}
      </header>

      <div className="divide-border-subtle divide-y">
        {(attachments ?? []).length === 0 && (
          <p className="text-ink-400 px-2 py-3 text-sm">Aucune piece jointe.</p>
        )}
        {(attachments ?? []).map((attachment) => (
          <div key={attachment.id} className="flex items-center gap-2 px-2 py-1.5">
            <Paperclip className="text-ink-400 size-3.5 shrink-0" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="text-ink-900 truncate text-sm font-semibold">{attachment.fileName}</p>
              <p className="text-ink-400 text-xs">
                {formatSize(attachment.sizeBytes)} - {attachment.uploadedBy.name}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Telecharger ${attachment.fileName}`}
              onClick={() => void download(attachment.id, attachment.fileName)}
            >
              <Download className="size-3.5" strokeWidth={1.75} />
            </Button>
            {canManage && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Supprimer ${attachment.fileName}`}
                onClick={() => remove.mutate(attachment.id)}
              >
                <Trash2 className="text-danger size-3.5" strokeWidth={1.75} />
              </Button>
            )}
          </div>
        ))}
      </div>

      {Boolean(error) && (
        <div className="px-2 py-1.5">
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
