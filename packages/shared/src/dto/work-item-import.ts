/** C.1 · Import de backlog depuis un fichier Excel (.xlsx) ou CSV. */
export const MAX_IMPORT_SIZE_MB = 10;

export const IMPORT_ALLOWED_MIME_TYPES = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export interface ImportRowIssue {
  /** Numéro de ligne dans le fichier (1 = première ligne de données, hors en-tête). */
  row: number;
  /** Clé du fichier source si lisible, pour aider à localiser la ligne. */
  key: string | null;
  message: string;
}

export interface WorkItemImportSummary {
  createdCount: number;
  epicCount: number;
  storyCount: number;
  subtaskCount: number;
  /** Lignes non importées (type illisible, parent introuvable, échec métier…). */
  skipped: ImportRowIssue[];
  /** Noms de la colonne Assigné sans correspondance parmi les membres du projet. */
  unmatchedAssignees: string[];
  /** Valeurs de la colonne Sprint sans correspondance parmi les sprints du projet. */
  unmatchedSprints: string[];
}
