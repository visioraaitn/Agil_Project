import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { WorkItemType, type ImportRowIssue, type WorkItemImportSummary } from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { UploadedFileLike } from '../storage/object-storage.service';
import { WorkItemsService } from './work-items.service';
import {
  buildHeaderIndex,
  normalizeHeader,
  parseImportRow,
  type ParsedImportRow,
} from './work-item-import.mapping';

/**
 * C.1 · Import de backlog depuis un fichier Excel/CSV externe (ex. export Jira).
 *
 * Chaque ligne passe par `WorkItemsService.create()`, exactement comme une
 * création manuelle : la hiérarchie, la numérotation et la validation des
 * références restent la seule logique existante, jamais dupliquée ici.
 * Toujours en ajout — aucune suppression du backlog existant.
 */
@Injectable()
export class WorkItemImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workItems: WorkItemsService,
  ) {}

  async importFromFile(
    projectId: string,
    file: UploadedFileLike,
    reporterId: string,
  ): Promise<WorkItemImportSummary> {
    const { rows, issues } = this.parseWorkbook(file);

    const [members, sprints] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: { projectId },
        select: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.sprint.findMany({ where: { projectId }, select: { id: true, name: true } }),
    ]);
    const assigneeIdByName = new Map(
      members.map((member) => [normalizeHeader(member.user.name), member.user.id]),
    );
    const sprintIdByName = new Map(sprints.map((sprint) => [normalizeHeader(sprint.name), sprint.id]));
    const labelIdByName = new Map<string, string>();

    const summary: WorkItemImportSummary = {
      createdCount: 0,
      epicCount: 0,
      storyCount: 0,
      subtaskCount: 0,
      skipped: [...issues],
      unmatchedAssignees: [],
      unmatchedSprints: [],
    };
    const unmatchedAssignees = new Set<string>();
    const unmatchedSprints = new Set<string>();

    // Résout les ID internes attribués pendant l'import, par clé du fichier source.
    const createdIdByKey = new Map<string, string>();

    const byType = (type: WorkItemType) => rows.filter((row) => row.type === type);
    const passes: ParsedImportRow[][] = [
      byType(WorkItemType.EPIC),
      [...byType(WorkItemType.STORY), ...byType(WorkItemType.BUG)],
      byType(WorkItemType.SUBTASK),
    ];

    for (const pass of passes) {
      for (const row of pass) {
        try {
          const parentId = row.parentKey ? (createdIdByKey.get(row.parentKey) ?? null) : null;
          if (row.parentKey && !parentId) {
            summary.skipped.push({
              row: row.rowNumber,
              key: row.key,
              message: `Parent "${row.parentKey}" introuvable (non importé ou hors ordre)`,
            });
            continue;
          }

          const assigneeId = row.assigneeName
            ? assigneeIdByName.get(normalizeHeader(row.assigneeName))
            : undefined;
          if (row.assigneeName && !assigneeId) unmatchedAssignees.add(row.assigneeName);

          const sprintId = row.sprintName
            ? sprintIdByName.get(normalizeHeader(row.sprintName))
            : undefined;
          if (row.sprintName && !sprintId) unmatchedSprints.add(row.sprintName);

          const labelIds: string[] = [];
          for (const labelName of [row.lot, row.sourceCharge]) {
            if (!labelName) continue;
            labelIds.push(await this.resolveLabelId(projectId, labelName, labelIdByName));
          }

          const isEpic = row.type === WorkItemType.EPIC;
          const created = await this.workItems.create(
            projectId,
            {
              type: row.type,
              title: row.title,
              parentId,
              description: row.description,
              priority: row.priority,
              status: row.status,
              // Un epic n'est pas estimé lui-même (C.1) : ses points viennent de ses descendants.
              storyPoints: isEpic ? null : row.storyPoints,
              assigneeIds: assigneeId ? [assigneeId] : undefined,
              sprintId: isEpic ? null : (sprintId ?? null),
              labelIds,
            },
            reporterId,
          );

          if (row.key) createdIdByKey.set(row.key, created.id);
          summary.createdCount += 1;
          if (row.type === WorkItemType.EPIC) summary.epicCount += 1;
          else if (row.type === WorkItemType.SUBTASK) summary.subtaskCount += 1;
          else summary.storyCount += 1;
        } catch (error) {
          summary.skipped.push({
            row: row.rowNumber,
            key: row.key,
            message: error instanceof Error ? error.message : 'Échec de création',
          });
        }
      }
    }

    summary.unmatchedAssignees = [...unmatchedAssignees];
    summary.unmatchedSprints = [...unmatchedSprints];
    return summary;
  }

  private async resolveLabelId(
    projectId: string,
    name: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const cacheKey = normalizeHeader(name);
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const label = await this.prisma.label.upsert({
      where: { projectId_name: { projectId, name } },
      update: {},
      create: { projectId, name },
      select: { id: true },
    });
    cache.set(cacheKey, label.id);
    return label.id;
  }

  private parseWorkbook(
    file: UploadedFileLike,
  ): { rows: ParsedImportRow[]; issues: ImportRowIssue[] } {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException({
        code: 'IMPORT_FILE_UNREADABLE',
        message: 'Le fichier ne peut pas être lu (attendu : .xlsx, .xls ou .csv)',
      });
    }

    const sheetName =
      workbook.SheetNames.find((name) => normalizeHeader(name) === 'backlog') ??
      workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException({
        code: 'IMPORT_FILE_EMPTY',
        message: 'Le fichier ne contient aucune feuille',
      });
    }

    const sheet = workbook.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
    const [headerRow, ...dataRows] = grid;
    if (!headerRow) {
      throw new BadRequestException({
        code: 'IMPORT_FILE_EMPTY',
        message: 'Le fichier ne contient aucune ligne',
      });
    }

    const headerIndex = buildHeaderIndex(headerRow);
    if (headerIndex.type === undefined || headerIndex.title === undefined) {
      throw new BadRequestException({
        code: 'IMPORT_HEADER_UNRECOGNIZED',
        message:
          'Colonnes Type et Résumé/Titre introuvables — vérifiez les en-têtes de la première ligne',
      });
    }

    const rows: ParsedImportRow[] = [];
    const issues: ImportRowIssue[] = [];
    dataRows.forEach((raw, index) => {
      const result = parseImportRow(raw, headerIndex, index + 1);
      if ('row' in result) rows.push(result.row);
      else issues.push(result.issue);
    });
    return { rows, issues };
  }
}
