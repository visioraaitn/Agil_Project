import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { TAG_COLORS, type TagSummary } from '@visiora/shared';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { InlineError } from '@/components/common/StateMessage';
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from '../hooks';

interface TagSectionProps {
  projectRef: string;
  selectedIds: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

export function TagSection({ projectRef, selectedIds, onChange, disabled = false }: TagSectionProps) {
  const { data: tags = [], isLoading } = useTags(projectRef);
  const createTag = useCreateTag(projectRef);
  const updateTag = useUpdateTag(projectRef);
  const deleteTag = useDeleteTag(projectRef);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagSummary | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(TAG_COLORS[0]);
  const [error, setError] = useState<unknown>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const openCreateDialog = () => {
    setEditingTag(null);
    setName('');
    setColor(TAG_COLORS[0]);
    setError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (tag: TagSummary) => {
    setEditingTag(tag);
    setName(tag.name);
    setColor(tag.color);
    setError(null);
    setActiveMenuId(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      if (editingTag) {
        await updateTag.mutateAsync({
          tagId: editingTag.id,
          input: { name: name.trim(), color },
        });
      } else {
        const created = await createTag.mutateAsync({
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

  const handleDelete = async (tag: TagSummary) => {
    setActiveMenuId(null);
    if (!window.confirm(`Supprimer le tag "${tag.name}" ? Il sera retiré de tous les tickets.`)) {
      return;
    }
    try {
      await deleteTag.mutateAsync(tag.id);
      if (selectedIds.includes(tag.id)) {
        onChange(selectedIds.filter((id) => id !== tag.id));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  const toggleSelect = (tagId: string) => {
    if (disabled) return;
    if (selectedIds.includes(tagId)) {
      onChange(selectedIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedIds, tagId]);
    }
  };

  return (
    <section className="space-y-1.5">
      <h3 className="text-ink-700 text-sm font-semibold">Tags</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => {
          const isSelected = selectedIds.includes(tag.id);
          const isMenuOpen = activeMenuId === tag.id;

          return (
            <div
              key={tag.id}
              className="relative inline-flex items-center rounded border border-border-subtle text-xs transition-shadow shadow-2xs group"
            >
              {/* Clickable chip body for toggle active / inactive */}
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggleSelect(tag.id)}
                className={`px-2 py-0.5 font-medium rounded-l transition-colors select-none ${
                  isSelected
                    ? 'text-white'
                    : 'text-ink-600 bg-surface-sunken hover:bg-surface-muted opacity-80 hover:opacity-100'
                }`}
                style={isSelected ? { backgroundColor: tag.color } : undefined}
                title={isSelected ? `Tag actif: ${tag.name}` : `Tag inactif: ${tag.name}`}
              >
                {tag.name}
              </button>

              {/* Action trigger menu */}
              {!disabled && (
                <div className="relative">
                  <button
                    type="button"
                    aria-label={`Options pour ${tag.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(isMenuOpen ? null : tag.id);
                    }}
                    className={`px-1 py-0.5 rounded-r border-l border-border-subtle/40 transition-colors ${
                      isSelected
                        ? 'text-white/80 hover:text-white hover:bg-black/15'
                        : 'text-ink-400 hover:text-ink-700 bg-surface-sunken hover:bg-surface-muted'
                    }`}
                    style={isSelected ? { backgroundColor: tag.color } : undefined}
                  >
                    <MoreVertical className="size-3" />
                  </button>

                  {isMenuOpen && (
                    <TagContextMenu
                      onEdit={() => openEditDialog(tag)}
                      onDelete={() => handleDelete(tag)}
                      onClose={() => setActiveMenuId(null)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!isLoading && tags.length === 0 && (
          <p className="text-ink-400 text-xs">Aucun tag défini sur ce projet.</p>
        )}

        {!disabled && (
          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex items-center gap-1 rounded border border-dashed border-border-strong px-2 py-0.5 text-xs font-medium text-ink-600 hover:border-accent-500 hover:text-accent-600 hover:bg-accent-50/50 transition-colors"
          >
            <Plus className="size-3" strokeWidth={2.5} />
            Nouveau tag
          </button>
        )}
      </div>

      {/* Modal create / edit tag */}
      <Modal
        open={dialogOpen}
        title={editingTag ? 'Modifier le tag' : 'Nouveau tag'}
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
              loading={createTag.isPending || updateTag.isPending}
            >
              Enregistrer
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Nom" htmlFor="tag-name" required>
            <Input
              id="tag-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Security, IA, Backend…"
            />
          </Field>

          <Field label="Couleur" htmlFor="tag-color" required>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {TAG_COLORS.map((c) => (
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
                  id="tag-color"
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

function TagContextMenu({
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
