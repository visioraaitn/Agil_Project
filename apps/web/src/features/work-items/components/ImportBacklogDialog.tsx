import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/common/StateMessage';
import { useImportWorkItems } from '../hooks';

interface ImportBacklogDialogProps {
  open: boolean;
  onClose: () => void;
  projectRef: string;
}

/**
 * C.1 · Import de backlog (Excel/CSV, ex. export Jira) — toujours en ajout,
 * jamais de suppression du backlog existant. Réutilise la création de
 * tickets existante côté backend ; ce dialog n'est qu'une interface.
 */
export function ImportBacklogDialog({ open, onClose, projectRef }: ImportBacklogDialogProps) {
  const importWorkItems = useImportWorkItems(projectRef);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      importWorkItems.reset();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (file) importWorkItems.mutate(file);
  };

  const close = () => {
    onClose();
  };

  const summary = importWorkItems.data;

  return (
    <Modal open={open} title="Importer un backlog (Excel / CSV)" onClose={close} width="md">
      <div className="flex flex-col gap-3">
        {!summary ? (
          <>
            <p className="text-ink-600 text-sm">
              Importe un fichier .xlsx, .xls ou .csv (ex. export Jira). Les tickets sont ajoutés au
              backlog existant — rien n'est supprimé. Colonnes reconnues : Clé, Type, Parent,
              Résumé, description, Assigné, Story points, Priorité, Sprint, Statut, Lot, Source
              charge.
            </p>

            <label
              className="border-border-strong hover:border-accent-400 hover:bg-surface-muted flex cursor-pointer flex-col items-center gap-2 rounded border border-dashed px-4 py-6 text-center"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="text-ink-400 size-5" strokeWidth={1.75} />
              <span className="text-ink-700 text-sm font-medium">
                {file ? file.name : 'Choisir un fichier…'}
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>

            <InlineError error={importWorkItems.error} />

            <div className="flex justify-end gap-2">
              <Button onClick={close}>Annuler</Button>
              <Button
                variant="primary"
                onClick={submit}
                loading={importWorkItems.isPending}
                disabled={!file}
              >
                Importer
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-accent-50 text-accent-700 flex items-center gap-2 rounded px-3 py-2 text-sm font-medium">
              <CheckCircle2 className="size-4 shrink-0" strokeWidth={2} />
              {summary.createdCount} ticket(s) créé(s) — {summary.epicCount} epic(s),{' '}
              {summary.storyCount} story/bug(s), {summary.subtaskCount} sous-tâche(s).
            </div>

            {summary.unmatchedAssignees.length > 0 && (
              <p className="text-ink-600 text-xs">
                Assignés sans correspondance dans l'équipe projet (laissés non assignés) :{' '}
                {summary.unmatchedAssignees.join(', ')}
              </p>
            )}
            {summary.unmatchedSprints.length > 0 && (
              <p className="text-ink-600 text-xs">
                Sprints sans correspondance (ticket laissé hors sprint) :{' '}
                {summary.unmatchedSprints.join(', ')}
              </p>
            )}

            {summary.skipped.length > 0 && (
              <div>
                <p className="text-danger mb-1 text-xs font-semibold">
                  {summary.skipped.length} ligne(s) non importée(s) :
                </p>
                <div className="border-border-default scrollbar-thin max-h-40 overflow-y-auto rounded border">
                  {summary.skipped.map((issue, index) => (
                    <div
                      key={`${issue.row}-${index}`}
                      className="border-border-subtle flex items-start gap-2 border-b px-2 py-1 text-xs last:border-b-0"
                    >
                      <span className="text-ink-400 shrink-0 font-semibold">
                        L{issue.row}
                        {issue.key ? ` · ${issue.key}` : ''}
                      </span>
                      <span className="text-ink-600">{issue.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="primary" onClick={close}>
                Fermer
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
