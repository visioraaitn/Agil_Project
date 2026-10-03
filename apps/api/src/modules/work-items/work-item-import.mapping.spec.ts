import { Priority, WorkItemStatus, WorkItemType } from '@visiora/shared';
import {
  buildHeaderIndex,
  mapPriority,
  mapStatus,
  mapType,
  normalizeHeader,
  parseImportRow,
} from './work-item-import.mapping';

describe('normalizeHeader', () => {
  it('retire les accents, la ponctuation et met en minuscules', () => {
    expect(normalizeHeader("User story & critères d'acceptation")).toBe(
      'user story criteres d acceptation',
    );
    expect(normalizeHeader('Épic')).toBe('epic');
    expect(normalizeHeader('  Clé  ')).toBe('cle');
  });
});

describe('buildHeaderIndex', () => {
  it("reconnaît les en-têtes du fichier Jira/Excel réel", () => {
    const header = [
      'Clé',
      'Type',
      'Lot',
      'Épic',
      'Parent',
      'Résumé',
      "User story & critères d'acceptation",
      'Rôle',
      'Personne (équipe)',
      'Assigné',
      'Estimation J/H',
      'Story points',
      'Priorité',
      'Sprint',
      'Source charge',
      'Dépendances',
      'Statut',
    ];
    const index = buildHeaderIndex(header);
    expect(index).toMatchObject({
      key: 0,
      type: 1,
      lot: 2,
      parent: 4,
      title: 5,
      description: 6,
      assignee: 9,
      storyPoints: 11,
      priority: 12,
      sprint: 13,
      sourceCharge: 14,
      status: 16,
    });
  });

  it('ignore les colonnes non reconnues sans planter', () => {
    expect(buildHeaderIndex(['Colonne mystère', 'Autre'])).toEqual({});
  });
});

describe('mapType', () => {
  it('reconnaît les types français et anglais', () => {
    expect(mapType('Epic')).toBe(WorkItemType.EPIC);
    expect(mapType('Story')).toBe(WorkItemType.STORY);
    expect(mapType('Sous-tâche')).toBe(WorkItemType.SUBTASK);
    expect(mapType('Sub-task')).toBe(WorkItemType.SUBTASK);
    expect(mapType('Bug')).toBe(WorkItemType.BUG);
  });

  it('retourne null pour un type inconnu ou vide', () => {
    expect(mapType('Tâche fantôme')).toBeNull();
    expect(mapType(null)).toBeNull();
  });
});

describe('mapPriority', () => {
  it('convertit l’échelle Jira (5 niveaux) sur l’échelle de l’application (4 niveaux)', () => {
    expect(mapPriority('Highest')).toBe(Priority.CRITICAL);
    expect(mapPriority('High')).toBe(Priority.HIGH);
    expect(mapPriority('Medium')).toBe(Priority.MEDIUM);
    expect(mapPriority('Low')).toBe(Priority.LOW);
    expect(mapPriority('Lowest')).toBe(Priority.LOW);
  });

  it('retombe sur Moyenne pour une valeur absente ou inconnue', () => {
    expect(mapPriority(null)).toBe(Priority.MEDIUM);
    expect(mapPriority('???')).toBe(Priority.MEDIUM);
  });
});

describe('mapStatus', () => {
  it('convertit les statuts français et anglais', () => {
    expect(mapStatus('To Do')).toBe(WorkItemStatus.TODO);
    expect(mapStatus('En cours')).toBe(WorkItemStatus.IN_PROGRESS);
    expect(mapStatus('Done')).toBe(WorkItemStatus.DONE);
    expect(mapStatus('Terminé')).toBe(WorkItemStatus.DONE);
  });

  it('retombe sur À faire pour une valeur absente ou inconnue', () => {
    expect(mapStatus(null)).toBe(WorkItemStatus.TODO);
    expect(mapStatus('Blocked')).toBe(WorkItemStatus.TODO);
  });
});

describe('parseImportRow', () => {
  const header = buildHeaderIndex(['Clé', 'Type', 'Parent', 'Résumé', 'Story points', 'Priorité']);

  it('construit une ligne exploitable à partir de cellules valides', () => {
    const result = parseImportRow(['US-59', 'Story', 'E20', 'Initialisation mobile', '8', 'Highest'], header, 3);
    expect(result).toEqual({
      row: expect.objectContaining({
        rowNumber: 3,
        key: 'US-59',
        type: WorkItemType.STORY,
        parentKey: 'E20',
        title: 'Initialisation mobile',
        storyPoints: 8,
        priority: Priority.CRITICAL,
      }),
    });
  });

  it('exclut une ligne dont le type est illisible, avec un message explicite', () => {
    const result = parseImportRow(['X1', 'Feature', null, 'Titre'], header, 5);
    expect(result).toEqual({
      issue: { row: 5, key: 'X1', message: expect.stringContaining('Feature') },
    });
  });

  it('exclut une ligne sans titre', () => {
    const result = parseImportRow(['X2', 'Story', null, null], header, 6);
    expect(result).toEqual({
      issue: { row: 6, key: 'X2', message: expect.stringContaining('Titre') },
    });
  });
});
