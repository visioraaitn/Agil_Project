import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BoardColumn as BoardColumnRow, Prisma } from '@prisma/client';
import {
  BOARD_COLUMNS,
  BoardColumnConfig,
  LABELS_FR,
  SaveBoardColumnsInput,
  WorkItemStatus,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';

type Db = PrismaService | Prisma.TransactionClient;

/** Colonne résolue pour un ticket : sa colonne personnalisée si elle porte encore son statut. */
export interface ColumnResolver {
  columns: BoardColumnConfig[];
  resolve(item: { status: string; boardColumnId: string | null }): BoardColumnConfig;
}

export function toBoardColumnConfig(row: BoardColumnRow): BoardColumnConfig {
  return {
    id: row.id,
    name: row.name,
    status: row.status as WorkItemStatus,
    isDefault: row.systemStatus !== null,
    position: row.position,
    wipLimit: row.wipLimit,
    isVisible: row.isVisible,
  };
}

/**
 * D.1 · Colonnes du Task Board, persistées par projet.
 *
 * Le workflow métier reste porté par `WorkItem.status` (rapports, approbation
 * des PR, clôture de sprint). Une colonne n'est qu'une vue sur un statut : les
 * 5 colonnes par défaut existent toujours, les colonnes personnalisées affinent
 * un statut. Un ticket est placé dans `boardColumnId` s'il pointe une colonne
 * de son statut, sinon dans la colonne par défaut de ce statut — il n'apparaît
 * donc jamais dans deux colonnes.
 */
@Injectable()
export class BoardColumnsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Colonnes du projet dans l'ordre d'affichage ; crée les colonnes par défaut au premier accès. */
  async list(projectId: string, db: Db = this.prisma): Promise<BoardColumnConfig[]> {
    await this.ensureDefaults(projectId, db);
    const rows = await db.boardColumn.findMany({
      where: { projectId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toBoardColumnConfig);
  }

  async resolver(projectId: string): Promise<ColumnResolver> {
    const columns = await this.list(projectId);
    const byId = new Map(columns.map((column) => [column.id, column]));
    const defaultByStatus = new Map(
      columns.filter((column) => column.isDefault).map((column) => [column.status, column]),
    );
    return {
      columns,
      resolve: (item) => {
        const custom = item.boardColumnId ? byId.get(item.boardColumnId) : undefined;
        if (custom && custom.status === item.status) return custom;
        const fallback = defaultByStatus.get(item.status as WorkItemStatus);
        if (!fallback) throw new Error(`Colonne par défaut manquante pour ${item.status}`);
        return fallback;
      },
    };
  }

  /** Colonne de destination d'un déplacement ; refuse une colonne d'un autre projet. */
  async findForMove(projectId: string, columnId: string): Promise<BoardColumnConfig> {
    await this.ensureDefaults(projectId, this.prisma);
    const row = await this.prisma.boardColumn.findFirst({ where: { id: columnId, projectId } });
    if (!row) {
      throw new NotFoundException({
        code: 'BOARD_COLUMN_NOT_FOUND',
        message: 'Colonne introuvable sur ce board',
      });
    }
    return toBoardColumnConfig(row);
  }

  /**
   * Remplace la configuration en bloc (ordre = ordre du tableau). Les colonnes
   * par défaut sont obligatoires et gardent leur statut ; une colonne
   * personnalisée absente est supprimée et ses tickets retombent (SET NULL)
   * dans la colonne par défaut de leur statut.
   */
  async save(projectId: string, input: SaveBoardColumnsInput): Promise<BoardColumnConfig[]> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.list(projectId, tx);
      const existingById = new Map(existing.map((column) => [column.id, column]));

      const sentIds = input.columns.flatMap((column) => (column.id ? [column.id] : []));
      if (new Set(sentIds).size !== sentIds.length) {
        throw this.invalid('BOARD_COLUMN_DUPLICATED', 'Une colonne apparaît deux fois');
      }
      const unknown = sentIds.find((id) => !existingById.has(id));
      if (unknown) {
        throw new NotFoundException({
          code: 'BOARD_COLUMN_NOT_FOUND',
          message: 'Colonne introuvable sur ce board',
        });
      }
      const missingDefault = existing.find(
        (column) => column.isDefault && !sentIds.includes(column.id),
      );
      if (missingDefault) {
        throw this.invalid(
          'BOARD_DEFAULT_COLUMN_REQUIRED',
          `La colonne « ${missingDefault.name} » est obligatoire : masquez-la plutôt que de la supprimer`,
        );
      }

      const removedIds = existing
        .filter((column) => !column.isDefault && !sentIds.includes(column.id))
        .map((column) => column.id);
      if (removedIds.length > 0) {
        await tx.boardColumn.deleteMany({ where: { projectId, id: { in: removedIds } } });
      }

      for (const [position, column] of input.columns.entries()) {
        const current = column.id ? existingById.get(column.id) : undefined;
        if (current) {
          // Le statut d'une colonne par défaut est figé : c'est elle qui l'incarne.
          const status = current.isDefault ? current.status : column.status;
          await tx.boardColumn.update({
            where: { id: current.id },
            data: {
              name: column.name,
              status,
              position,
              wipLimit: column.wipLimit ?? null,
              isVisible: column.isVisible,
            },
          });
          // Une colonne personnalisée qui change de statut ne garde pas des
          // tickets d'un autre statut : ils retournent à leur colonne par défaut.
          if (!current.isDefault && status !== current.status) {
            await tx.workItem.updateMany({
              where: { boardColumnId: current.id },
              data: { boardColumnId: null },
            });
          }
        } else {
          await tx.boardColumn.create({
            data: {
              projectId,
              name: column.name,
              status: column.status,
              position,
              wipLimit: column.wipLimit ?? null,
              isVisible: column.isVisible,
            },
          });
        }
      }

      return this.list(projectId, tx);
    });
  }

  /** Crée les 5 colonnes par défaut si besoin ; idempotent et sûr en concurrence. */
  private async ensureDefaults(projectId: string, db: Db): Promise<void> {
    const count = await db.boardColumn.count({ where: { projectId, systemStatus: { not: null } } });
    if (count === BOARD_COLUMNS.length) return;

    const offset = await db.boardColumn.count({ where: { projectId } });
    await db.boardColumn.createMany({
      data: BOARD_COLUMNS.map((status, index) => ({
        projectId,
        name: LABELS_FR.workItemStatus[status],
        status,
        systemStatus: status,
        position: offset + index,
      })),
      // L'unicité (projectId, systemStatus) absorbe les créations concurrentes.
      skipDuplicates: true,
    });
  }

  private invalid(code: string, message: string): BadRequestException {
    return new BadRequestException({ code, message });
  }
}
