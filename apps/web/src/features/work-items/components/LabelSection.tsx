import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { LABEL_COLORS, type LabelSummary } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/common/StateMessage';
import { useCreateLabel, useDeleteLabel, useLabels, useUpdateLabel } from '../hooks';

interface LabelSectionProps {
  projectRef: string;
  selectedIds: string[];
  onChange: (labelIds: string[]) => void;
  disabled?: boolean;
}

export function LabelSection({
  projectRef,
  selectedIds,
  onChange,
  disabled = false,
}: LabelSectionProps) {
  const { data: labels = [], isLoading } = useLabels(projectRef);
  const createLabel = useCreateLabel(projectRef);
  const updateLabel = useUpdateLabel(projectRef);
  const deleteLabel = useDeleteLabel(projectRef);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<LabelSummary | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(LABEL_COLORS[0]);
  const [error, setError] = useState<unknown>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const openCreateDialog = () => {
    setEditingLabel(null);
    setName('');
    setColor(LABEL_COLORS[0]);
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (label: LabelSummary) => {
    setEditingLabel(label);
    setName(label.name);
    setColor(label.color);
    setError(null);
    setActiveMenuId(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      if (editingLabel) {
        await updateLabel.mutateAsync({
          labelId: editingLabel.id,
          input: { name: name.trim(), color },
        });
      } else {
        const created = await createLabel.mutateAsync({
          name: name.trim(),
          color,
        });
        if (!selectedIds.includes(created.id)) {
          onChange([...selectedIds, created.id]);
        }
      }
      setDialogOpen(false);
    } catch (err) {
      setError(err);
    }
  };

  const handleDelete = async (label: LabelSummary) => {
    setActiveMenuId(null);
    if (
      !window.confirm(
        `Supprimer l'étiquette "${label.name}" ? Elle sera retirée de tous les tickets.`,
      )
    ) {
      return;
    }
    try {
      await deleteLabel.mutateAsync(label.id);
      if (selectedIds.includes(label.id)) {
        onChange(selectedIds.filter((id) => id !== label.id));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  const toggleSelect = (labelId: string) => {
    if (disabled) return;
    if (selectedIds.includes(labelId)) {
      onChange(selectedIds.filter((id) => id !== labelId));
    } else {
      onChange([...selectedIds, labelId]);
    }
  };

  return (
    <section className="space-y-1.5">
      <h3 className="text-ink-700 text-sm font-semibold">Étiquettes</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {labels.map((label) => {
          const isSelected = selectedIds.includes(label.id);
          const isMenuOpen = activeMenuId === label.id;

          return (
            <div
              key={label.id}
              className="relative inline-flex items-center rounded border border-border-subtle text-xs transition-shadow shadow-2xs group"
            >
              {/* Clickable chip body for toggle active / inactive */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleSelect(label.id)}
                className={`px-2 py-0.5 font-medium rounded-l transition-colors select-none ${
                  isSelected
                    ? 'text-white'
                    : 'text-ink-600 bg-surface-sunken hover:bg-surface-muted opacity-80 hover:opacity-100'
                }`}
                style={isSelected ? { backgroundColor: label.color } : undefined}
                title={isSelected ? `Étiquette active: ${label.name}` : `Étiquette inactive: ${label.name}`}
              >
                {label.name}
              </button>

              {/* Action trigger menu */}
              {!disabled && (
                <div className="relative">
                  <button
                    type="button"
                    aria-label={`Options pour ${label.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(isMenuOpen ? null : label.id);
                    }}
                    className={`px-1 py-0.5 rounded-r border-l border-border-subtle/40 transition-colors ${
                      isSelected
                        ? 'text-white/80 hover:text-white hover:bg-black/15'
                        : 'text-ink-400 hover:text-ink-700 bg-surface-sunken hover:bg-surface-muted'
                    }`}
                    style={isSelected ? { backgroundColor: label.color } : undefined}
                  >
                    <MoreVertical className="size-3" />
                  </button>

                  {isMenuOpen && (
                    <LabelContextMenu
                      onEdit={() => openEditDialog(label)}
                      onDelete={() => handleDelete(label)}
                      onClose={() => setActiveMenuId(null)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!isLoading && labels.length === 0 && (
          <p className="text-ink-400 text-xs">Aucune étiquette définie sur ce projet.</p>
        )}

        {!disabled && (
          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex items-center gap-1 rounded border border-dashed border-border-strong px-2 py-0.5 text-xs font-medium text-ink-600 hover:border-accent-500 hover:text-accent-600 hover:bg-accent-50/50 transition-colors"
          >
            <Plus className="size-3" strokeWidth={2.5} />
            Nouvelle étiquette
          </button>
        )}
      </div>

      {/* Modal create / edit label */}
      <Modal
        open={dialogOpen}
        title={editingLabel ? "Modifier l'étiquette" : 'Nouvelle étiquette'}
        onClose={() => setDialogOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!name.trim()}
              loading={createLabel.isPending || updateLabel.isPending}
            >
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Nom" htmlFor="label-name" required>
            <Input
              id="label-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Devis, Lot 1, Urgent…"
            />
          </Field>

          <Field label="Couleur" htmlFor="label-color" required>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {LABEL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`size-6 rounded-full transition-transform ${
                      color.toUpperCase() === c.toUpperCase()
                        ? 'ring-2 ring-accent-500 ring-offset-2 scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Couleur ${c}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={color.startsWith('#') && color.length === 7 ? color : '#0078D4'}
                  onChange={(e) => setColor(e.target.value)}
                  className="size-8 cursor-pointer rounded border border-border-default p-0.5 bg-surface"
                />
                <Input
                  id="label-color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#0078D4"
                  className="w-28 font-mono text-xs uppercase"
                />
              </div>
            </div>
          </Field>

          <InlineError error={error} />
        </div>
      </Modal>
    </section>
  );
}

function LabelContextMenu({
  onEdit,
  onDelete,
  onClose,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded border border-border-default bg-surface py-1 shadow-lg text-xs"
    >
      <button
        type="button"
        onClick={onEdit}
        className="flex w-full items-center gap-1.5 px-2.5 py-1 text-ink-700 hover:bg-surface-muted text-left"
      >
        <Pencil className="size-3 text-ink-500" />
        Modifier
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center gap-1.5 px-2.5 py-1 text-danger hover:bg-danger/10 text-left"
      >
        <Trash2 className="size-3 text-danger" />
        Supprimer
      </button>
    </div>
  );
}
