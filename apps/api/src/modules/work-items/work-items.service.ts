import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BacklogNode,
  BoardColumn,
  BOARD_COLUMNS,
  CreateWorkItemInput,
  MoveWorkItemInput,
  UpdateWorkItemInput,
  WorkItemDetail,
  WorkItemFilters,
  WorkItemStatus,
  WorkItemSummary,
  WorkItemType,
  canBeChildOf,
  REQUIRES_PARENT,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RankingService } from './ranking.service';
import {
  ChildAggregate,
  WORK_ITEM_DETAIL_SELECT,
  WORK_ITEM_SUMMARY_SELECT,
  WorkItemSummaryRow,
  toWorkItemDetail,
  toWorkItemSummary,
} from './work-item.mapper';

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ranking: RankingService,
  ) {}

  // --- Lecture ------------------------------------------------------------

  /**
   * C.1 · Backlog hiérarchique. Une seule requête ramène tous les tickets du
   * projet, l'arbre est reconstruit en mémoire : à l'échelle d'un projet agile
   * (quelques milliers de tickets au plus) c'est plus rapide qu'un aller-retour
   * par niveau, et cela garantit un arbre cohérent.
   */
  async getBacklog(projectId: string, filters: WorkItemFilters): Promise<BacklogNode[]> {
    const rows = await this.prisma.workItem.findMany({
      where: this.buildWhere(projectId, filters),
      select: WORK_ITEM_SUMMARY_SELECT,
      orderBy: { rank: 'asc' },
    });

    const aggregates = this.computeAggregates(rows);
    const nodes = new Map<string, BacklogNode>(
      rows.map((row) => [
        row.id,
        { ...toWorkItemSummary(row, aggregates.get(row.id)), children: [] },
      ]),
    );

    const roots: BacklogNode[] = [];
    for (const row of rows) {
      const node = nodes.get(row.id);
      if (!node) continue;
      const parent = row.parentId ? nodes.get(row.parentId) : undefined;
      // Un ticket dont le parent est filtré remonte à la racine plutôt que de disparaître.
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    return roots;
  }

  /** D.1 · Board : les tickets répartis dans les 5 colonnes de statut. */
  async getBoard(projectId: string, filters: WorkItemFilters): Promise<BoardColumn[]> {
    const rows = await this.prisma.workItem.findMany({
      where: {
        ...this.buildWhere(projectId, filters),
        // Le board suit le travail réalisable : les epics restent au backlog.
        type: filters.type ?? { in: [WorkItemType.STORY, WorkItemType.BUG, WorkItemType.SUBTASK] },
      },
      select: WORK_ITEM_SUMMARY_SELECT,
      orderBy: { boardRank: 'asc' },
    });

    const aggregates = this.computeAggregates(rows);
    const items = rows.map((row) => toWorkItemSummary(row, aggregates.get(row.id)));

    return BOARD_COLUMNS.map((status) => {
      const columnItems = items.filter((item) => item.status === status);
      return {
        status,
        items: columnItems,
        count: columnItems.length,
        points: columnItems.reduce((total, item) => total + (item.storyPoints ?? 0), 0),
      };
    });
  }

  async getById(projectId: string, itemId: string): Promise<WorkItemDetail> {
    const row = await this.prisma.workItem.findFirst({
      where: { id: itemId, projectId, deletedAt: null },
      select: WORK_ITEM_DETAIL_SELECT,
    });
    if (!row) throw this.notFound();

    const children = await this.prisma.workItem.findMany({
      where: { parentId: itemId, deletedAt: null },
      select: WORK_ITEM_SUMMARY_SELECT,
      orderBy: { rank: 'asc' },
    });

    const childAggregates = this.computeAggregates(children);
    const aggregate: ChildAggregate = {
      childCount: children.length,
      doneChildCount: children.filter((child) => child.status === WorkItemStatus.DONE).length,
      rolledUpPoints: children.reduce((total, child) => total + (child.storyPoints ?? 0), 0),
    };

    return toWorkItemDetail(
      row,
      aggregate,
      children.map((child) => toWorkItemSummary(child, childAggregates.get(child.id))),
    );
  }

  // --- Écriture -----------------------------------------------------------

  async create(
    projectId: string,
    input: CreateWorkItemInput,
    reporterId: string,
  ): Promise<WorkItemDetail> {
    await this.assertHierarchy(projectId, input.type, input.parentId ?? null);
    await this.assertReferences(projectId, input.assigneeId, input.sprintId, input.labelIds);

    const { rank, boardRank } = await this.ranking.initialRanks(
      projectId,
      input.parentId ?? null,
      WorkItemStatus.TODO,
    );

    /**
     * Numéro et création dans une seule transaction : deux créations simultanées
     * ne peuvent pas produire le même « VIS-142 ».
     */
    const created = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id: projectId },
        data: { lastItemNumber: { increment: 1 } },
        select: { lastItemNumber: true },
      });

      return tx.workItem.create({
        data: {
          projectId,
          number: project.lastItemNumber,
          type: input.type,
          title: input.title,
          description: input.description ?? null,
          technicalNotes: input.technicalNotes ?? null,
          priority: input.priority,
          storyPoints: input.storyPoints ?? null,
          parentId: input.parentId ?? null,
          assigneeId: input.assigneeId ?? null,
          sprintId: input.sprintId ?? null,
          startDate: input.startDate ?? null,
          dueDate: input.dueDate ?? null,
          reporterId,
          rank,
          boardRank,
          ...(input.labelIds?.length
            ? { labels: { create: input.labelIds.map((labelId) => ({ labelId })) } }
            : {}),
        },
        select: { id: true },
      });
    });

    return this.getById(projectId, created.id);
  }

  async update(
    projectId: string,
    itemId: string,
    input: UpdateWorkItemInput,
  ): Promise<WorkItemDetail> {
    const existing = await this.prisma.workItem.findFirst({
      where: { id: itemId, projectId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!existing) throw this.notFound();

    await this.assertReferences(projectId, input.assigneeId, input.sprintId, input.labelIds);

    const closesNow = input.status === WorkItemStatus.DONE && existing.status !== WorkItemStatus.DONE;
    const reopens = input.status !== undefined && input.status !== WorkItemStatus.DONE;

    await this.prisma.$transaction(async (tx) => {
      await tx.workItem.update({
        where: { id: itemId },
        data: {
          ...pick(input, [
            'title',
            'description',
            'technicalNotes',
            'status',
            'priority',
            'storyPoints',
            'assigneeId',
            'sprintId',
            'startDate',
            'dueDate',
            'isBlocked',
            'blockedReason',
          ]),
          ...(closesNow ? { closedAt: new Date() } : {}),
          ...(reopens ? { closedAt: null } : {}),
        },
      });

      // Les étiquettes sont remplacées en bloc : le client envoie l'état voulu.
      if (input.labelIds) {
        await tx.workItemLabel.deleteMany({ where: { workItemId: itemId } });
        if (input.labelIds.length > 0) {
          await tx.workItemLabel.createMany({
            data: input.labelIds.map((labelId) => ({ workItemId: itemId, labelId })),
            skipDuplicates: true,
          });
        }
      }

      // Idem pour les critères d'acceptation : la liste envoyée fait foi.
      if (input.acceptanceCriteria) {
        await tx.acceptanceCriterion.deleteMany({ where: { workItemId: itemId } });
        if (input.acceptanceCriteria.length > 0) {
          await tx.acceptanceCriterion.createMany({
            data: input.acceptanceCriteria.map((criterion, index) => ({
              workItemId: itemId,
              content: criterion.content,
              isMet: criterion.isMet,
              position: index,
            })),
          });
        }
      }
    });

    return this.getById(projectId, itemId);
  }

  /**
   * D.1 · Déplacement sur le board (changement de statut) et C.1 · réordonnancement
   * du backlog passent par le même point d'entrée : dans les deux cas il s'agit
   * de repositionner un ticket parmi ses voisins.
   */
  async move(projectId: string, itemId: string, input: MoveWorkItemInput): Promise<WorkItemSummary> {
    const item = await this.prisma.workItem.findFirst({
      where: { id: itemId, projectId, deletedAt: null },
      select: { id: true, type: true, status: true, parentId: true },
    });
    if (!item) throw this.notFound();

    const changesParent = input.parentId !== undefined;
    const targetParentId = changesParent ? (input.parentId ?? null) : item.parentId;

    if (changesParent) {
      await this.assertHierarchy(projectId, item.type as WorkItemType, targetParentId);
      await this.assertNoCycle(itemId, targetParentId);
    }

    const data: Prisma.WorkItemUpdateInput = {};

    // Déplacement de colonne : on recalcule le rang board.
    if (input.status !== undefined || input.beforeId || input.afterId) {
      const targetStatus = input.status ?? (item.status as WorkItemStatus);
      const isBoardMove = input.status !== undefined;

      if (isBoardMove) {
        data.status = targetStatus;
        data.closedAt = targetStatus === WorkItemStatus.DONE ? new Date() : null;
        data.boardRank = await this.ranking.computeRank(
          'boardRank',
          { beforeId: input.beforeId, afterId: input.afterId },
          { projectId, status: targetStatus },
        );
      } else {
        data.rank = await this.ranking.computeRank(
          'rank',
          { beforeId: input.beforeId, afterId: input.afterId },
          { projectId, parentId: targetParentId },
        );
      }
    }

    if (changesParent) {
      data.parent = targetParentId ? { connect: { id: targetParentId } } : { disconnect: true };
      // Nouveau voisinage : si aucune position n'a été calculée, on place en fin.
      if (data.rank === undefined && !input.status) {
        data.rank = await this.ranking.computeRank('rank', {}, { projectId, parentId: targetParentId });
      }
    }

    if (input.sprintId !== undefined) {
      data.sprint = input.sprintId ? { connect: { id: input.sprintId } } : { disconnect: true };
    }

    await this.prisma.workItem.update({ where: { id: itemId }, data });

    const row = await this.prisma.workItem.findUniqueOrThrow({
      where: { id: itemId },
      select: WORK_ITEM_SUMMARY_SELECT,
    });
    return toWorkItemSummary(row);
  }

  /** Suppression logique, propagée aux descendants. */
  async softDelete(projectId: string, itemId: string): Promise<void> {
    const item = await this.prisma.workItem.findFirst({
      where: { id: itemId, projectId, deletedAt: null },
      select: { id: true },
    });
    if (!item) throw this.notFound();

    const ids = await this.collectDescendants(itemId);
    await this.prisma.workItem.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() },
    });
  }

  // --- Règles et utilitaires ---------------------------------------------

  private buildWhere(projectId: string, filters: WorkItemFilters): Prisma.WorkItemWhereInput {
    return {
      projectId,
      deletedAt: null,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.sprintId ? { sprintId: filters.sprintId } : {}),
      ...(filters.isBlocked !== undefined ? { isBlocked: filters.isBlocked } : {}),
      ...(filters.hideDone ? { status: { not: WorkItemStatus.DONE } } : {}),
      ...(filters.labelId ? { labels: { some: { labelId: filters.labelId } } } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  /** Agrège les descendants directs de chaque ticket de la liste fournie. */
  private computeAggregates(rows: WorkItemSummaryRow[]): Map<string, ChildAggregate> {
    const aggregates = new Map<string, ChildAggregate>();

    for (const row of rows) {
      if (!row.parentId) continue;
      const current = aggregates.get(row.parentId) ?? {
        childCount: 0,
        doneChildCount: 0,
        rolledUpPoints: 0,
      };
      current.childCount += 1;
      if (row.status === WorkItemStatus.DONE) current.doneChildCount += 1;
      current.rolledUpPoints += row.storyPoints ?? 0;
      aggregates.set(row.parentId, current);
    }

    return aggregates;
  }

  private async assertHierarchy(
    projectId: string,
    type: WorkItemType,
    parentId: string | null,
  ): Promise<void> {
    if (!parentId) {
      if (REQUIRES_PARENT.includes(type)) {
        throw new BadRequestException({
          code: 'PARENT_REQUIRED',
          message: 'Une sous-tâche doit être rattachée à une user story ou à un bug',
        });
      }
      return;
    }

    const parent = await this.prisma.workItem.findFirst({
      where: { id: parentId, projectId, deletedAt: null },
      select: { type: true },
    });
    if (!parent) {
      throw new BadRequestException({
        code: 'PARENT_NOT_FOUND',
        message: "Le ticket parent n'existe pas dans ce projet",
      });
    }

    if (!canBeChildOf(type, parent.type as WorkItemType)) {
      throw new BadRequestException({
        code: 'INVALID_HIERARCHY',
        message: `Un ticket de type ${type} ne peut pas être rattaché à un ${parent.type}`,
      });
    }
  }

  /** Empêche qu'un ticket devienne son propre ancêtre. */
  private async assertNoCycle(itemId: string, parentId: string | null): Promise<void> {
    if (!parentId) return;
    if (parentId === itemId) {
      throw new BadRequestException({
        code: 'HIERARCHY_CYCLE',
        message: 'Un ticket ne peut pas être son propre parent',
      });
    }

    const descendants = await this.collectDescendants(itemId);
    if (descendants.includes(parentId)) {
      throw new BadRequestException({
        code: 'HIERARCHY_CYCLE',
        message: 'Un ticket ne peut pas être rattaché à l’un de ses descendants',
      });
    }
  }

  /** Identifiants du ticket et de toute sa descendance. */
  private async collectDescendants(itemId: string): Promise<string[]> {
    const collected = [itemId];
    let frontier = [itemId];

    // La hiérarchie est bornée à 3 niveaux ; la boucle reste courte.
    while (frontier.length > 0) {
      const children = await this.prisma.workItem.findMany({
        where: { parentId: { in: frontier }, deletedAt: null },
        select: { id: true },
      });
      frontier = children.map((child) => child.id);
      collected.push(...frontier);
    }

    return collected;
  }

  private async assertReferences(
    projectId: string,
    assigneeId?: string | null,
    sprintId?: string | null,
    labelIds?: string[],
  ): Promise<void> {
    if (assigneeId) {
      // L'assigné doit être membre du projet : on n'assigne pas un inconnu.
      const membership = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: assigneeId } },
        select: { id: true },
      });
      if (!membership) {
        throw new BadRequestException({
          code: 'ASSIGNEE_NOT_MEMBER',
          message: "L'assigné doit être membre du projet",
        });
      }
    }

    if (sprintId) {
      const sprint = await this.prisma.sprint.findFirst({
        where: { id: sprintId, projectId },
        select: { id: true },
      });
      if (!sprint) {
        throw new BadRequestException({
          code: 'SPRINT_NOT_FOUND',
          message: "Ce sprint n'appartient pas au projet",
        });
      }
    }

    if (labelIds?.length) {
      const count = await this.prisma.label.count({
        where: { projectId, id: { in: labelIds } },
      });
      if (count !== new Set(labelIds).size) {
        throw new BadRequestException({
          code: 'LABEL_NOT_FOUND',
          message: 'Une étiquette référencée n’appartient pas au projet',
        });
      }
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: 'WORK_ITEM_NOT_FOUND', message: "Ce ticket n'existe pas" });
  }
}

/**
 * Ne conserve que les clés explicitement fournies (`undefined` = pas de changement).
 * Le type de retour est restreint aux clés demandées : un `Partial<T>` laisserait
 * croire à Prisma que des champs relationnels comme `acceptanceCriteria` peuvent
 * être présents, ce qui rend le `data` inassignable.
 */
function pick<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}
