import { useState } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { WorkItemStatus } from '@visiora/shared';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getDefaultBoardConfig,
  saveBoardConfig,
  type BoardConfig,
  type ColumnDefinition,
} from '../board-config';

interface BoardColumnsConfigDialogProps {
  open: boolean;
  onClose: () => void;
  projectKey: string;
  config: BoardConfig;
  onChange: (next: BoardConfig) => void;
}

export function BoardColumnsConfigDialog({
  open,
  onClose,
  projectKey,
  config,
  onChange,
}: BoardColumnsConfigDialogProps) {
  const [columns, setColumns] = useState<ColumnDefinition[]>(config.columns);
  const [newColName, setNewColName] = useState('');
  const [newColWip, setNewColWip] = useState('');

  const handleNameChange = (id: string, name: string) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, name } : col)),
    );
  };

  const handleWipChange = (id: string, value: string) => {
    const num = value ? parseInt(value, 10) : null;
    setColumns((prev) =>
      prev.map((col) =>
        col.id === id ? { ...col, wipLimit: num && num > 0 ? num : null } : col,
      ),
    );
  };

  const handleToggleVisible = (id: string, visible: boolean) => {
    setColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, visible } : col)),
    );
  };

  const handleRemoveCustomColumn = (id: string) => {
    setColumns((prev) => prev.filter((col) => col.id !== id));
  };

  const handleAddColumn = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newColName.trim();
    if (!name) return;

    const wipLimit = newColWip ? parseInt(newColWip, 10) : null;

    const newCol: ColumnDefinition = {
      id: `col-custom-${Date.now()}`,
      status: WorkItemStatus.IN_PROGRESS,
      name,
      wipLimit: wipLimit && wipLimit > 0 ? wipLimit : null,
      visible: true,
      isCustom: true,
    };

    setColumns((prev) => [...prev, newCol]);
    setNewColName('');
    setNewColWip('');
  };

  const handleReset = () => {
    const defaults = getDefaultBoardConfig();
    setColumns(defaults.columns);
  };

  const handleSave = () => {
    const nextConfig: BoardConfig = { columns };
    saveBoardConfig(projectKey, nextConfig);
    onChange(nextConfig);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Personnaliser et ajouter des colonnes"
      onClose={onClose}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={handleReset} className="mr-auto gap-1 text-xs">
            <RotateCcw className="size-3.5" />
            Réinitialiser par défaut
          </Button>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" onClick={handleSave}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-ink-500 text-sm">
          Gérez le nom de vos colonnes, ajustez vos limites de cartes (WIP) ou ajoutez de nouvelles colonnes.
        </p>

        {/* Liste des colonnes */}
        <div className="border-border-default divide-border-subtle divide-y rounded border max-h-64 overflow-y-auto">
          {columns.map((col) => (
            <div key={col.id} className="bg-surface p-2.5 flex items-center gap-3">
              <input
                type="checkbox"
                id={`toggle-${col.id}`}
                checked={col.visible !== false}
                onChange={(e) => handleToggleVisible(col.id, e.target.checked)}
                className="size-4 rounded accent-accent-600 cursor-pointer"
                title="Afficher/Masquer la colonne"
              />

              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-ink-700 text-xs font-semibold">
                    Colonne
                  </span>
                  {col.isCustom && (
                    <span className="bg-accent-100 text-accent-800 rounded px-1.5 py-0.2 text-[10px] font-semibold">
                      Personnalisée
                    </span>
                  )}
                </div>
                <Input
                  value={col.name}
                  placeholder="Nom de la colonne"
                  disabled={col.visible === false}
                  onChange={(e) => handleNameChange(col.id, e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="w-24">
                <label htmlFor={`wip-${col.id}`} className="text-ink-400 text-xs block mb-1 font-medium">
                  Limite WIP
                </label>
                <Input
                  id={`wip-${col.id}`}
                  type="number"
                  min="1"
                  max="50"
                  placeholder="Illimité"
                  disabled={col.visible === false}
                  value={col.wipLimit ?? ''}
                  onChange={(e) => handleWipChange(col.id, e.target.value)}
                  className="h-8 text-sm text-center"
                />
              </div>

              {col.isCustom && (
                <button
                  type="button"
                  onClick={() => handleRemoveCustomColumn(col.id)}
                  className="text-ink-400 hover:text-danger mt-4 rounded p-1 transition-colors"
                  title="Supprimer cette colonne"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Formulaire d'ajout de nouvelle colonne simplifié (Nom + WIP uniquement) */}
        <div className="bg-surface-sunken border-border-default rounded border p-3">
          <h3 className="text-ink-800 text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Plus className="size-4 text-accent-600" />
            <span>Ajouter une nouvelle colonne</span>
          </h3>

          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-7">
              <label htmlFor="new-col-name" className="text-ink-500 text-xs block mb-1 font-medium">
                Nom de la colonne
              </label>
              <Input
                id="new-col-name"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="Ex: En cours de revue, QA, Recette..."
                className="h-8 text-sm"
              />
            </div>

            <div className="col-span-3">
              <label htmlFor="new-col-wip" className="text-ink-500 text-xs block mb-1 font-medium">
                Limite WIP (opt.)
              </label>
              <Input
                id="new-col-wip"
                type="number"
                min="1"
                max="50"
                value={newColWip}
                onChange={(e) => setNewColWip(e.target.value)}
                placeholder="Illimité"
                className="h-8 text-sm text-center"
              />
            </div>

            <div className="col-span-2 flex items-end">
              <Button
                type="button"
                variant="primary"
                disabled={!newColName.trim()}
                onClick={() => handleAddColumn()}
                className="w-full h-8 text-xs font-medium"
              >
                Ajouter
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
