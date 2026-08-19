import { Download, Printer, CheckCircle, Sparkles } from 'lucide-react';
import type { SprintDetail } from '@visiora/shared';
import { LABELS_FR, RetroCategory } from '@visiora/shared';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { StatusPill, TypeIcon } from '@/features/work-items/components/WorkItemChrome';

interface SprintReportDialogProps {
  open: boolean;
  onClose: () => void;
  sprint: SprintDetail;
  projectName?: string;
}

export function SprintReportDialog({
  open,
  onClose,
  sprint,
  projectName = 'VisioraAI Agile',
}: SprintReportDialogProps) {
  const totalPoints = sprint.liveCommittedPoints || sprint.committedPoints || 0;
  const donePoints = sprint.liveCompletedPoints || sprint.completedPoints || 0;
  const completionRate = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
  const completedItems = sprint.items.filter((it) => it.status === 'DONE');
  const remainingItems = sprint.items.filter((it) => it.status !== 'DONE');

  const exportCSV = () => {
    const headers = ['Cle', 'Type', 'Titre', 'Statut', 'Points', 'Assignee'];
    const rows = sprint.items.map((it) => [
      it.key,
      it.type,
      `"${it.title.replace(/"/g, '""')}"`,
      it.status,
      it.storyPoints ?? '',
      `"${it.assignee?.name ?? 'Non assigne'}"`,
    ]);

    const csvContent = [
      `Rapport de Sprint : ${sprint.name}`,
      `Projet : ${projectName}`,
      `Periode : ${formatDate(sprint.startDate)} au ${formatDate(sprint.endDate)}`,
      `Points engages : ${totalPoints} | Points termines : ${donePoints} (${completionRate}%)`,
      '',
      headers.join(';'),
      ...rows.map((r) => r.join(';')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rapport-sprint-${sprint.name.toLowerCase().replace(/\s+/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      open={open}
      title={`Rapport de Synthèse · ${sprint.name}`}
      onClose={onClose}
      width="md"
      footer={
        <div className="flex items-center justify-between w-full no-print">
          <span className="text-ink-400 text-xs">
            Format A4 institutionnel & export tabulaire
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={exportCSV} className="gap-1.5 text-xs">
              <Download className="size-3.5" />
              <span>Exporter CSV</span>
            </Button>
            <Button variant="primary" onClick={handlePrint} className="gap-1.5 text-xs">
              <Printer className="size-3.5" />
              <span>Imprimer / PDF</span>
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-1 print:p-0">
        {/* En-tête du rapport */}
        <div className="border-b border-border-default pb-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-accent-600 text-xs font-bold uppercase tracking-wider">
                {projectName}
              </span>
              <h2 className="text-ink-900 text-xl font-bold">{sprint.name}</h2>
            </div>
            <span className="bg-surface-sunken text-ink-700 border border-border-default rounded px-2.5 py-1 text-xs font-semibold">
              {LABELS_FR.sprintStatus[sprint.status]}
            </span>
          </div>

          <p className="text-ink-500 text-xs mt-1">
            Période : <strong>{formatDate(sprint.startDate)}</strong> au <strong>{formatDate(sprint.endDate)}</strong>
          </p>

          {sprint.goal && (
            <div className="mt-3 bg-surface-muted border-l-3 border-accent-500 p-2.5 rounded-r text-xs text-ink-800">
              <span className="font-semibold block text-ink-900 mb-0.5">Objectif du Sprint :</span>
              {sprint.goal}
            </div>
          )}
        </div>

        {/* KPIs Synthétiques */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-surface-sunken border border-border-default rounded p-2.5 text-center">
            <span className="text-ink-400 text-[11px] font-semibold uppercase block">Taux de Succès</span>
            <span className="text-2xl font-bold text-accent-600">{completionRate}%</span>
          </div>
          <div className="bg-surface-sunken border border-border-default rounded p-2.5 text-center">
            <span className="text-ink-400 text-[11px] font-semibold uppercase block">Points Livrés</span>
            <span className="text-2xl font-bold text-emerald-600">{donePoints} <span className="text-xs text-ink-400 font-normal">/ {totalPoints} pts</span></span>
          </div>
          <div className="bg-surface-sunken border border-border-default rounded p-2.5 text-center">
            <span className="text-ink-400 text-[11px] font-semibold uppercase block">Tickets Terminés</span>
            <span className="text-2xl font-bold text-ink-900">{completedItems.length} <span className="text-xs text-ink-400 font-normal">/ {sprint.items.length}</span></span>
          </div>
          <div className="bg-surface-sunken border border-border-default rounded p-2.5 text-center">
            <span className="text-ink-400 text-[11px] font-semibold uppercase block">Restants / Reportés</span>
            <span className="text-2xl font-bold text-amber-600">{remainingItems.length}</span>
          </div>
        </div>

        {/* Tableau des tickets du sprint */}
        <div>
          <h3 className="text-ink-900 text-sm font-bold mb-2 flex items-center gap-1.5">
            <CheckCircle className="size-4 text-emerald-600" />
            <span>Bilan des Réalisations ({completedItems.length} livrés, {remainingItems.length} restants)</span>
          </h3>

          <div className="border border-border-default rounded overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-muted text-ink-500 font-semibold border-b border-border-default">
                <tr>
                  <th className="p-2 w-16">Clé</th>
                  <th className="p-2">Titre</th>
                  <th className="p-2 w-28">Statut</th>
                  <th className="p-2 w-16 text-center">Points</th>
                  <th className="p-2 w-32">Assigné</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-surface">
                {sprint.items.map((it) => (
                  <tr key={it.id} className={it.status === 'DONE' ? 'bg-emerald-50/20' : ''}>
                    <td className="p-2 font-mono font-semibold text-ink-400">{it.key}</td>
                    <td className="p-2 font-medium text-ink-900 flex items-center gap-1.5">
                      <TypeIcon type={it.type} />
                      <span className="truncate">{it.title}</span>
                    </td>
                    <td className="p-2">
                      <StatusPill status={it.status} />
                    </td>
                    <td className="p-2 text-center font-bold text-ink-700">
                      {it.storyPoints ?? '-'}
                    </td>
                    <td className="p-2 text-ink-600 truncate">
                      {it.assignee?.name ?? <span className="text-ink-400 italic">Non assigné</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Synthèse Rétrospective */}
        {sprint.retrospectiveItems && sprint.retrospectiveItems.length > 0 && (
          <div>
            <h3 className="text-ink-900 text-sm font-bold mb-2 flex items-center gap-1.5">
              <Sparkles className="size-4 text-accent-600" />
              <span>Synthèse de la Rétrospective d'Équipe</span>
            </h3>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-50/40 border border-emerald-200 rounded p-2.5">
                <span className="text-emerald-800 font-bold text-xs block mb-1.5">✅ Ce qui s'est bien passé</span>
                <ul className="list-disc ml-3.5 space-y-1 text-xs text-ink-700">
                  {sprint.retrospectiveItems
                    .filter((r) => r.category === RetroCategory.WENT_WELL)
                    .map((r) => (
                      <li key={r.id}>{r.content}</li>
                    ))}
                </ul>
              </div>

              <div className="bg-amber-50/40 border border-amber-200 rounded p-2.5">
                <span className="text-amber-800 font-bold text-xs block mb-1.5">⚠️ Axes d'amélioration</span>
                <ul className="list-disc ml-3.5 space-y-1 text-xs text-ink-700">
                  {sprint.retrospectiveItems
                    .filter((r) => r.category === RetroCategory.TO_IMPROVE)
                    .map((r) => (
                      <li key={r.id}>{r.content}</li>
                    ))}
                </ul>
              </div>

              <div className="bg-blue-50/40 border border-blue-200 rounded p-2.5">
                <span className="text-blue-800 font-bold text-xs block mb-1.5">🎯 Plan d'action</span>
                <ul className="list-disc ml-3.5 space-y-1 text-xs text-ink-700">
                  {sprint.retrospectiveItems
                    .filter((r) => r.category === RetroCategory.ACTION_ITEM)
                    .map((r) => (
                      <li key={r.id} className={r.isDone ? 'line-through text-ink-400' : ''}>
                        {r.content}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}
