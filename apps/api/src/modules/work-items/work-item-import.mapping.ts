import { Priority, WorkItemStatus, WorkItemType, type ImportRowIssue } from '@visiora/shared';

/** Colonnes reconnues dans le fichier source, par clé logique interne. */
export type ImportField =
  | 'key'
  | 'type'
  | 'parent'
  | 'title'
  | 'description'
  | 'assignee'
  | 'storyPoints'
  | 'priority'
  | 'sprint'
  | 'status'
  | 'lot'
  | 'sourceCharge';

/**
 * En-têtes reconnus par colonne logique, sous forme déjà normalisée
 * (minuscules, accents retirés, ponctuation remplacée par des espaces).
 * Volontairement tolérant : un fichier Jira/Excel réel varie légèrement
 * d'une extraction à l'autre.
 */
const HEADER_SYNONYMS: Record<ImportField, readonly string[]> = {
  key: ['cle', 'key', 'issue id', 'id'],
  type: ['type', 'issue type'],
  parent: ['parent', 'parent id'],
  title: ['resume', 'summary', 'titre', 'title'],
  description: [
    'user story criteres d acceptation',
    'description',
    'user story',
  ],
  assignee: ['assigne', 'assignee', 'responsable'],
  storyPoints: ['story points', 'story point estimate'],
  priority: ['priorite', 'priority'],
  sprint: ['sprint'],
  status: ['statut', 'status'],
  lot: ['lot'],
  sourceCharge: ['source charge'],
};

/** Minuscules, sans accents, ponctuation réduite à des espaces simples. */
export function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Construit, à partir de la ligne d'en-tête, l'index de colonne pour chaque champ reconnu. */
export function buildHeaderIndex(headerRow: unknown[]): Partial<Record<ImportField, number>> {
  const normalized = headerRow.map(normalizeHeader);
  const index: Partial<Record<ImportField, number>> = {};

  for (const field of Object.keys(HEADER_SYNONYMS) as ImportField[]) {
    const synonyms = HEADER_SYNONYMS[field];
    const columnIndex = normalized.findIndex((header) => synonyms.includes(header));
    if (columnIndex !== -1) index[field] = columnIndex;
  }

  return index;
}

function cell(row: unknown[], index: number | undefined): string | null {
  if (index === undefined) return null;
  const value = row[index];
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

const TYPE_SYNONYMS: Record<string, WorkItemType> = {
  epic: WorkItemType.EPIC,
  story: WorkItemType.STORY,
  'user story': WorkItemType.STORY,
  bug: WorkItemType.BUG,
  'sous tache': WorkItemType.SUBTASK,
  subtask: WorkItemType.SUBTASK,
  'sub task': WorkItemType.SUBTASK,
};

export function mapType(raw: string | null): WorkItemType | null {
  if (!raw) return null;
  return TYPE_SYNONYMS[normalizeHeader(raw)] ?? null;
}

const PRIORITY_SYNONYMS: Record<string, Priority> = {
  highest: Priority.CRITICAL,
  critical: Priority.CRITICAL,
  critique: Priority.CRITICAL,
  high: Priority.HIGH,
  haute: Priority.HIGH,
  medium: Priority.MEDIUM,
  moyenne: Priority.MEDIUM,
  low: Priority.LOW,
  lowest: Priority.LOW,
  basse: Priority.LOW,
};

/** Retombe sur la priorité par défaut de l'application plutôt que d'inventer une valeur. */
export function mapPriority(raw: string | null): Priority {
  if (!raw) return Priority.MEDIUM;
  return PRIORITY_SYNONYMS[normalizeHeader(raw)] ?? Priority.MEDIUM;
}

const STATUS_SYNONYMS: Record<string, WorkItemStatus> = {
  'to do': WorkItemStatus.TODO,
  'a faire': WorkItemStatus.TODO,
  'in progress': WorkItemStatus.IN_PROGRESS,
  'en cours': WorkItemStatus.IN_PROGRESS,
  'in test': WorkItemStatus.IN_TEST,
  'en test': WorkItemStatus.IN_TEST,
  'ready for approval': WorkItemStatus.READY_FOR_APPROVAL,
  'pret pour approbation': WorkItemStatus.READY_FOR_APPROVAL,
  done: WorkItemStatus.DONE,
  termine: WorkItemStatus.DONE,
};

/** Retombe sur le statut initial de l'application plutôt que d'inventer une valeur. */
export function mapStatus(raw: string | null): WorkItemStatus {
  if (!raw) return WorkItemStatus.TODO;
  return STATUS_SYNONYMS[normalizeHeader(raw)] ?? WorkItemStatus.TODO;
}

export interface ParsedImportRow {
  rowNumber: number;
  key: string | null;
  type: WorkItemType;
  parentKey: string | null;
  title: string;
  description: string | null;
  assigneeName: string | null;
  storyPoints: number | null;
  priority: Priority;
  sprintName: string | null;
  status: WorkItemStatus;
  lot: string | null;
  sourceCharge: string | null;
}

export type ParseRowResult = { row: ParsedImportRow } | { issue: ImportRowIssue };

/** Transforme une ligne brute en entrée exploitable, ou en motif d'exclusion explicite. */
export function parseImportRow(
  raw: unknown[],
  headerIndex: Partial<Record<ImportField, number>>,
  rowNumber: number,
): ParseRowResult {
  const key = cell(raw, headerIndex.key);
  const typeRaw = cell(raw, headerIndex.type);
  const type = mapType(typeRaw);
  if (!type) {
    return {
      issue: {
        row: rowNumber,
        key,
        message: typeRaw
          ? `Type "${typeRaw}" non reconnu (attendu : Epic, Story, Bug ou Sous-tâche)`
          : 'Colonne Type vide',
      },
    };
  }

  const title = cell(raw, headerIndex.title);
  if (!title) {
    return { issue: { row: rowNumber, key, message: 'Titre (Résumé) vide' } };
  }

  const storyPointsRaw = cell(raw, headerIndex.storyPoints);
  const storyPoints =
    storyPointsRaw !== null && !Number.isNaN(Number(storyPointsRaw))
      ? Math.round(Number(storyPointsRaw))
      : null;

  return {
    row: {
      rowNumber,
      key,
      type,
      parentKey: cell(raw, headerIndex.parent),
      title,
      description: cell(raw, headerIndex.description),
      assigneeName: cell(raw, headerIndex.assignee),
      storyPoints,
      priority: mapPriority(cell(raw, headerIndex.priority)),
      sprintName: cell(raw, headerIndex.sprint),
      status: mapStatus(cell(raw, headerIndex.status)),
      lot: cell(raw, headerIndex.lot),
      sourceCharge: cell(raw, headerIndex.sourceCharge),
    },
  };
}
