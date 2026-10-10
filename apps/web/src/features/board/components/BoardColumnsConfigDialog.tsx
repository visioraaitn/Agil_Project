import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  BOARD_COLUMNS,
  LABELS_FR,
  WorkItemStatus,
  type BoardColumnConfig,
  type SaveBoardColumnsInput,
} from '@visiora/shared';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { InlineError } from '@/components/common/StateMessage';
import { useSaveBoardColumns } from '@/features/work-items/hooks';
import { STATUS_DOT } from '@/features/work-items/status-colors';
import { cn } from '@/lib/utils';

interface BoardColumnsConfigDialogProps {
  open: boolean;
  onClose: () => void;
  projectKey: string;
  /** Toutes les colonnes du board (visibles ou non), dans l'ordre. */
  columns: BoardColumnConfig[];
}

/** Ligne éditable : `id` absent tant qu'une nouvelle colonne n'est pas enregistrée. */
interface DraftColumn {
  key: string;
  id?: string;
  name: string;
  status: WorkItemStatus;
  isDefault: boolean;
  wipLimit: number | null;
  isVisible: boolean;
}

const toDraft = (column: BoardColumnConfig): DraftColumn => ({
  key: column.id,
  id: column.id,
  name: column.name,
  status: column.status,
  isDefault: column.isDefault,
  wipLimit: column.wipLimit,
  isVisible: column.isVisible,
});

const parseWip = (value: string): number | null => {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/**
 * D.1 · Colonnes du board, partagées par toute l'équipe et enregistrées côté
 * serveur. Une colonne personnalisée est rattachée à une étape du workflow :
 * déposer une carte dessus lui donne ce statut, sans jamais la dupliquer.
 */
export function BoardColumnsConfigDialog({
  open,
  onClose,
  projectKey,
  columns,
}: BoardColumnsConfigDialogProps) {
  const save = useSaveBoardColumns(projectKey);
  const [draft, setDraft] = useState<DraftColumn[]>(() => columns.map(toDraft));
  const [newName, setNewName] = useState('');
  const [newStatus, setNewStatus] = useState<WorkItemStatus>(WorkItemStatus.IN_PROGRESS);
  const [newWip, setNewWip] = useState('');

  // Chaque ouverture repart de l'état serveur.
  useEffect(() => {
    if (!open) return;
    setDraft(columns.map(toDraft));
    setNewName('');
    setNewWip('');
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seule l'ouverture réinitialise le brouillon
  }, [open]);

  const update = (key: string, patch: Partial<DraftColumn>) =>
    setDraft((current) =>
      current.map((column) => (column.key === key ? { ...column, ...patch } : column)),
    );

  const move = (index: number, offset: -1 | 1) =>
    setDraft((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(target, 0, moved);
      return next;
    });

  const addColumn = () => {
    const name = newName.trim();
    if (!name) return;
    setDraft((current) => [
      ...current,
      {
        key: `new-${crypto.randomUUID()}`,
        name,
        status: newStatus,
        isDefault: false,
        wipLimit: parseWip(newWip),
        isVisible: true,
      },
    ]);
    setNewName('');
    setNewWip('');
  };

  /**
   * Restaure noms, visibilité, limites et ordre par défaut. Les colonnes
   * personnalisées sont conservées, placées après la colonne de leur statut.
   */
  const resetDefaults = () =>
    setDraft((current) =>
      BOARD_COLUMNS.flatMap((status) => [
        ...current
          .filter((column) => column.isDefault && column.status === status)
          .map((column) => ({
            ...column,
            name: LABELS_FR.workItemStatus[status],
            wipLimit: null,
            isVisible: true,
          })),
        ...current.filter((column) => !column.isDefault && column.status === status),
      ]),
    );

  const submit = async () => {
    const input: SaveBoardColumnsInput = {
      columns: draft.map((column) => ({
        id: column.id,
        name: column.name.trim(),
        status: column.status,
        wipLimit: column.wipLimit,
        isVisible: column.isVisible,
      })),
    };
    try {
      await save.mutateAsync(input);
      onClose();
    } catch {
      // L'erreur reste affichée dans le dialogue (save.error).
    }
  };

  const invalid = draft.some((column) => !column.name.trim());

  return (
    <Modal
      open={open}
      title="Colonnes du board"
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={resetDefaults} className="mr-auto">
            <RotateCcw strokeWidth={1.75} />
            Réinitialiser par défaut
          </Button>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={submit} loading={save.isPending} disabled={invalid}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-ink-500 text-sm">
          Les colonnes sont partagées par toute l'équipe. Une colonne personnalisée affine une étape
          du workflow : y déposer une carte lui donne ce statut. Les colonnes par défaut se masquent
          mais ne se suppriment pas.
        </p>

        <InlineError error={save.error} />

        <ul className="border-border-default divide-border-subtle max-h-80 divide-y overflow-y-auto rounded-xl border">
          {draft.map((column, index) => (
            <li key={column.key} className="bg-surface flex items-end gap-3 p-3">
              <div className="flex flex-col gap-0.5 self-center">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Monter la colonne ${column.name}`}
                  className="text-ink-500 hover:bg-surface-sunken rounded p-0.5 disabled:opacity-30"
                >
                  <ArrowUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === draft.length - 1}
                  aria-label={`Descendre la colonne ${column.name}`}
                  className="text-ink-500 hover:bg-surface-sunken rounded p-0.5 disabled:opacity-30"
                >
                  <ArrowDown className="size-3.5" />
                </button>
              </div>

              <input
                type="checkbox"
                checked={column.isVisible}
                onChange={(event) => update(column.key, { isVisible: event.target.checked })}
                aria-label={`Afficher la colonne ${column.name}`}
                className="accent-accent-600 mb-2.5 size-4 cursor-pointer"
              />

              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5">
                  <span className={cn('size-2 rounded-full', STATUS_DOT[column.status])} />
                  <span className="text-ink-700 text-xs font-semibold">
                    {column.isDefault ? 'Colonne par défaut' : 'Colonne personnalisée'}
                  </span>
                </div>
                <Input
                  value={column.name}
                  aria-label="Nom de la colonne"
                  onChange={(event) => update(column.key, { name: event.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              <div className="w-44">
                <span className="text-ink-500 mb-1 block text-xs font-medium">
                  Étape du workflow
                </span>
                <Select
                  value={column.status}
                  disabled={column.isDefault}
                  aria-label={`Étape du workflow de ${column.name}`}
                  onChange={(event) =>
                    update(column.key, { status: event.target.value as WorkItemStatus })
                  }
                  className="text-sm"
                >
                  {BOARD_COLUMNS.map((status) => (
                    <option key={status} value={status}>
                      {LABELS_FR.workItemStatus[status]}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="w-20">
                <span className="text-ink-500 mb-1 block text-xs font-medium">Limite WIP</span>
                <Input
                  type="number"
                  min="1"
                  max="999"
                  placeholder="∞"
                  aria-label={`Limite WIP de ${column.name}`}
                  value={column.wipLimit ?? ''}
                  onChange={(event) =>
                    update(column.key, { wipLimit: parseWip(event.target.value) })
                  }
                  className="h-8 text-center text-sm"
                />
              </div>

              {column.isDefault ? (
                <span className="w-7" aria-hidden />
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) => current.filter((entry) => entry.key !== column.key))
                  }
                  className="text-ink-400 hover:text-danger mb-1 rounded p-1 transition-colors"
                  aria-label={`Supprimer la colonne ${column.name}`}
                  title="Supprimer : ses tickets retournent dans la colonne par défaut de leur statut"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>

        <form
          className="bg-surface-muted border-border-default rounded-xl border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            addColumn();
          }}
        >
          <h3 className="text-ink-900 mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Plus className="text-accent-600 size-4" />
            Ajouter une colonne
          </h3>
          <div className="grid grid-cols-12 items-end gap-2">
            <label className="col-span-5">
              <span className="text-ink-500 mb-1 block text-xs font-medium">Nom</span>
              <Input
                id="new-col-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Ex. Revue, QA, Recette…"
                className="h-8 text-sm"
              />
            </label>
            <label className="col-span-4">
              <span className="text-ink-500 mb-1 block text-xs font-medium">Étape du workflow</span>
              <Select
                value={newStatus}
                onChange={(event) => setNewStatus(event.target.value as WorkItemStatus)}
                className="text-sm"
              >
                {BOARD_COLUMNS.map((status) => (
                  <option key={status} value={status}>
                    {LABELS_FR.workItemStatus[status]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="col-span-1">
              <span className="text-ink-500 mb-1 block text-xs font-medium">WIP</span>
              <Input
                type="number"
                min="1"
                max="999"
                value={newWip}
                onChange={(event) => setNewWip(event.target.value)}
                placeholder="∞"
                className="h-8 px-1 text-center text-sm"
              />
            </label>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!newName.trim()}
              className="col-span-2 h-8"
            >
              Ajouter
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
