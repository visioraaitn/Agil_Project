import * as XLSX from 'xlsx';
import { WorkItemType, type WorkItemDetail } from '@visiora/shared';
import type { UploadedFileLike } from '../storage/object-storage.service';
import { WorkItemImportService } from './work-item-import.service';
import { WorkItemsService } from './work-items.service';

const PROJECT_ID = 'project-1';
const REPORTER_ID = 'reporter-1';

function buildFile(rows: (string | number | null)[][]): UploadedFileLike {
  const header = [
    'Clé',
    'Type',
    'Parent',
    'Résumé',
    "User story & critères d'acceptation",
    'Assigné',
    'Story points',
    'Priorité',
    'Sprint',
    'Statut',
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Backlog');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return { originalname: 'backlog.xlsx', mimetype: 'application/octet-stream', size: buffer.length, buffer };
}

describe('WorkItemImportService', () => {
  function buildService(members: { user: { id: string; name: string } }[], sprints: { id: string; name: string }[]) {
    const prisma = {
      projectMember: { findMany: jest.fn().mockResolvedValue(members) },
      sprint: { findMany: jest.fn().mockResolvedValue(sprints) },
      label: {
        upsert: jest.fn(({ create }: { create: { name: string } }) =>
          Promise.resolve({ id: `label-${create.name}` }),
        ),
      },
    };
    let nextId = 1;
    const created: { type: WorkItemType; parentId: string | null }[] = [];
    const workItems = {
      create: jest.fn((_projectId: string, input: Record<string, unknown>) => {
        const id = `item-${nextId++}`;
        created.push({ type: input.type as WorkItemType, parentId: input.parentId as string | null });
        return Promise.resolve({ id } as WorkItemDetail);
      }),
    };
    const service = new WorkItemImportService(
      prisma as unknown as ConstructorParameters<typeof WorkItemImportService>[0],
      workItems as unknown as WorkItemsService,
    );
    return { service, prisma, workItems, created };
  }

  it('crée Epic puis Story puis Sous-tâche dans cet ordre, en résolvant les parents', async () => {
    const { service, workItems, created } = buildService(
      [{ user: { id: 'user-1', name: 'Youssef Feki' } }],
      [{ id: 'sprint-1', name: 'S01' }],
    );

    const file = buildFile([
      ['E1', 'Epic', null, 'Epic racine', null, null, null, 'Highest', null, 'In Progress'],
      ['US-1', 'Story', 'E1', 'Story fille', 'Détails', 'Youssef Feki', 8, 'High', 'S01', 'To Do'],
      ['US-1-T1', 'Sous-tâche', 'US-1', 'Sous-tâche fille', null, null, null, 'Medium', null, 'Done'],
    ]);

    const summary = await service.importFromFile(PROJECT_ID, file, REPORTER_ID);

    expect(summary).toMatchObject({
      createdCount: 3,
      epicCount: 1,
      storyCount: 1,
      subtaskCount: 1,
      skipped: [],
      unmatchedAssignees: [],
      unmatchedSprints: [],
    });

    expect(workItems.create).toHaveBeenCalledTimes(3);
    expect(created[0]).toEqual({ type: WorkItemType.EPIC, parentId: null });
    expect(created[1]).toEqual({ type: WorkItemType.STORY, parentId: 'item-1' });
    expect(created[2]).toEqual({ type: WorkItemType.SUBTASK, parentId: 'item-2' });

    const storyInput = workItems.create.mock.calls[1][1] as Record<string, unknown>;
    expect(storyInput.assigneeIds).toEqual(['user-1']);
    expect(storyInput.sprintId).toBe('sprint-1');
  });

  it("ignore une ligne dont le parent n'a pas été importé (hors ordre ou inexistant)", async () => {
    const { service } = buildService([], []);
    const file = buildFile([
      ['US-1', 'Story', 'E-INCONNU', 'Story orpheline', null, null, null, null, null, null],
    ]);

    const summary = await service.importFromFile(PROJECT_ID, file, REPORTER_ID);

    expect(summary.createdCount).toBe(0);
    expect(summary.skipped).toEqual([
      expect.objectContaining({ row: 1, key: 'US-1', message: expect.stringContaining('E-INCONNU') }),
    ]);
  });

  it('signale les assignés et sprints sans correspondance sans bloquer la création', async () => {
    const { service, workItems } = buildService([], []);
    const file = buildFile([
      ['E1', 'Epic', null, 'Epic', null, 'Personne Inconnue', null, null, 'S99', null],
    ]);

    const summary = await service.importFromFile(PROJECT_ID, file, REPORTER_ID);

    expect(summary.createdCount).toBe(1);
    expect(summary.unmatchedAssignees).toEqual(['Personne Inconnue']);
    expect(summary.unmatchedSprints).toEqual(['S99']);
    const input = workItems.create.mock.calls[0][1] as Record<string, unknown>;
    expect(input.assigneeIds).toBeUndefined();
  });

  it('continue les lignes suivantes si WorkItemsService.create échoue sur une ligne', async () => {
    const { service, workItems } = buildService([], []);
    workItems.create.mockRejectedValueOnce(new Error('ASSIGNEE_NOT_MEMBER'));
    const file = buildFile([
      ['E1', 'Epic', null, 'Epic en échec', null, null, null, null, null, null],
      ['E2', 'Epic', null, 'Epic suivant', null, null, null, null, null, null],
    ]);

    const summary = await service.importFromFile(PROJECT_ID, file, REPORTER_ID);

    expect(summary.createdCount).toBe(1);
    expect(summary.skipped).toEqual([
      expect.objectContaining({ row: 1, key: 'E1', message: 'ASSIGNEE_NOT_MEMBER' }),
    ]);
  });
});
