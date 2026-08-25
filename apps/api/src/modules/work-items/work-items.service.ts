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
  WorkItemSortBy,
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
      orderBy: this.buildOrderBy(filters, 'backlog'),
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
      orderBy: this.buildOrderBy(filters, 'board'),
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
    const assigneeIds = resolveAssigneeIds(input) ?? [];
    await this.assertReferences(projectId, assigneeIds, input.sprintId, input.labelIds);

    const targetStatus = input.status ?? WorkItemStatus.TODO;

    const { rank, boardRank } = await this.ranking.initialRanks(
      projectId,
      input.parentId ?? null,
      targetStatus,
    );

    /** Le numero est alloue dans la portee type/parent avec protection concurrente. */
    const created = await this.numberedTransaction(async (tx) => {
      const number = await this.nextAvailableNumber(
        tx,
        projectId,
        input.type,
        input.parentId ?? null,
      );
      return tx.workItem.create({
        data: {
          projectId,
          number,
          type: input.type,
          title: input.title,
          status: targetStatus,
          description: input.description ?? null,
          technicalNotes: input.technicalNotes ?? null,
          priority: input.priority,
          storyPoints: input.storyPoints ?? null,
          parentId: input.parentId ?? null,
          assigneeId: assigneeIds[0] ?? null,
          sprintId: input.sprintId ?? null,
          startDate: input.startDate ?? null,
          dueDate: input.dueDate ?? null,
          reporterId,
          rank,
          boardRank,
          ...(targetStatus === WorkItemStatus.DONE ? { closedAt: new Date() } : {}),
          ...(input.labelIds?.length
            ? { labels: { create: input.labelIds.map((labelId) => ({ labelId })) } }
            : {}),
          ...(assigneeIds.length
            ? { assignees: { create: assigneeIds.map((userId) => ({ userId })) } }
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
      select: { id: true, type: true, status: true, parentId: true },
    });
    if (!existing) throw this.notFound();

    const changesParent = input.parentId !== undefined && input.parentId !== existing.parentId;
    const targetParentId = input.parentId !== undefined ? input.parentId : existing.parentId;
    if (changesParent) {
      await this.assertHierarchy(projectId, existing.type as WorkItemType, targetParentId);
      await this.assertNoCycle(itemId, targetParentId);
    }

    const assigneeIds = resolveAssigneeIds(input);
    await this.assertReferences(projectId, assigneeIds, input.sprintId, input.labelIds);

    const closesNow =
      input.status === WorkItemStatus.DONE && existing.status !== WorkItemStatus.DONE;
    const reopens = input.status !== undefined && input.status !== WorkItemStatus.DONE;
    const targetRank = changesParent
      ? await this.ranking.computeRank('rank', {}, { projectId, parentId: targetParentId })
      : undefined;

    const updateInTransaction = async (tx: Prisma.TransactionClient) => {
      const number = changesParent
        ? await this.nextAvailableNumber(
            tx,
            projectId,
            existing.type as WorkItemType,
            targetParentId,
          )
        : undefined;

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
            'sprintId',
            'startDate',
            'dueDate',
            'isBlocked',
            'blockedReason',
          ]),
          ...(assigneeIds !== undefined ? { assigneeId: assigneeIds[0] ?? null } : {}),
          ...(changesParent
            ? {
                number,
                parentId: targetParentId,
                rank: targetRank,
              }
            : {}),
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

      // La liste envoyée remplace toutes les affectations du ticket.
      if (assigneeIds !== undefined) {
        await tx.workItemAssignee.deleteMany({ where: { workItemId: itemId } });
        if (assigneeIds.length > 0) {
          await tx.workItemAssignee.createMany({
            data: assigneeIds.map((userId) => ({ workItemId: itemId, userId })),
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
    };

    if (changesParent) await this.numberedTransaction(updateInTransaction);
    else await this.prisma.$transaction(updateInTransaction);

    return this.getById(projectId, itemId);
  }

  /**
   * D.1 · Déplacement sur le board (changement de statut) et C.1 · réordonnancement
   * du backlog passent par le même point d'entrée : dans les deux cas il s'agit
   * de repositionner un ticket parmi ses voisins.
   */
  async move(
    projectId: string,
    itemId: string,
    input: MoveWorkItemInput,
  ): Promise<WorkItemSummary> {
    const item = await this.prisma.workItem.findFirst({
      where: { id: itemId, projectId, deletedAt: null },
      select: { id: true, type: true, status: true, parentId: true },
    });
    if (!item) throw this.notFound();

    const parentProvided = input.parentId !== undefined;
    const targetParentId = parentProvided ? (input.parentId ?? null) : item.parentId;
    const changesParent = parentProvided && targetParentId !== item.parentId;

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
        data.rank = await this.ranking.computeRank(
          'rank',
          {},
          { projectId, parentId: targetParentId },
        );
      }
    }

    if (input.sprintId !== undefined) {
      data.sprint = input.sprintId ? { connect: { id: input.sprintId } } : { disconnect: true };
    }

    if (changesParent) {
      await this.numberedTransaction(async (tx) => {
        const number = await this.nextAvailableNumber(
          tx,
          projectId,
          item.type as WorkItemType,
          targetParentId,
        );
        await tx.workItem.update({ where: { id: itemId }, data: { ...data, number } });
      });
    } else {
      await this.prisma.workItem.update({ where: { id: itemId }, data });
    }

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
    const compoundFilters: Prisma.WorkItemWhereInput[] = [];
    if (filters.assigneeId) {
      compoundFilters.push({
        OR: [
          { assignees: { some: { userId: filters.assigneeId } } },
          { assigneeId: filters.assigneeId },
        ],
      });
    }
    if (filters.search) {
      compoundFilters.push({
        OR: [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { technicalNotes: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    return {
      projectId,
      deletedAt: null,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.creatorId ? { reporterId: filters.creatorId } : {}),
      ...(filters.sprintId ? { sprintId: filters.sprintId } : {}),
      ...(filters.isBlocked !== undefined ? { isBlocked: filters.isBlocked } : {}),
      ...(filters.hideDone ? { status: { not: WorkItemStatus.DONE } } : {}),
      ...(filters.labelId ? { labels: { some: { labelId: filters.labelId } } } : {}),
      ...(compoundFilters.length ? { AND: compoundFilters } : {}),
    };
  }

  private buildOrderBy(
    filters: WorkItemFilters,
    view: 'backlog' | 'board',
  ): Prisma.WorkItemOrderByWithRelationInput[] {
    const direction = filters.sortOrder ?? 'asc';
    const field = filters.sortBy;
    const stableColumn = view === 'backlog' ? 'rank' : 'boardRank';

    if (!field) return [{ [stableColumn]: 'asc' }];

    const column = field === WorkItemSortBy.KEY ? 'number' : field;
    return [{ [column]: direction }, { [stableColumn]: 'asc' }];
  }

  /** Retourne le premier entier positif libre dans une portee de numerotation. */
  private async nextAvailableNumber(
    tx: Prisma.TransactionClient,
    projectId: string,
    type: WorkItemType,
    parentId: string | null,
  ): Promise<number> {
    const rows = await tx.workItem.findMany({
      where: { projectId, type, parentId, deletedAt: null },
      select: { number: true },
      orderBy: { number: 'asc' },
    });
    return smallestAvailableNumber(rows.map((row) => row.number));
  }

  /** Transactions serialisables avec rejeu des rares conflits concurrents. */
  private async numberedTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const maxAttempts = 4;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const retryable =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2002' || error.code === 'P2034');
        if (!retryable || attempt === maxAttempts) throw error;
      }
    }
    throw new Error('Transaction de numerotation impossible');
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
    assigneeIds?: string[],
    sprintId?: string | null,
    labelIds?: string[],
  ): Promise<void> {
    if (assigneeIds?.length) {
      const uniqueIds = [...new Set(assigneeIds)];
      const membershipCount = await this.prisma.projectMember.count({
        where: { projectId, userId: { in: uniqueIds } },
      });
      if (membershipCount !== uniqueIds.length) {
        throw new BadRequestException({
          code: 'ASSIGNEE_NOT_MEMBER',
          message: 'Chaque personne assignée doit être membre du projet',
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
    return new NotFoundException({
      code: 'WORK_ITEM_NOT_FOUND',
      message: "Ce ticket n'existe pas",
    });
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

/** Convertit les nouveaux `assigneeIds` et l'ancien `assigneeId` en une liste
 * unique. `undefined` signifie qu'une mise à jour ne touche pas aux assignés. */
function resolveAssigneeIds(input: {
  assigneeIds?: string[];
  assigneeId?: string | null;
}): string[] | undefined {
  if (input.assigneeIds !== undefined) return [...new Set(input.assigneeIds)];
  if (input.assigneeId !== undefined) return input.assigneeId ? [input.assigneeId] : [];
  return undefined;
}

/** Premier entier strictement positif absent d'une liste, sans supposer sa continuite. */
export function smallestAvailableNumber(numbers: readonly number[]): number {
  let candidate = 1;
  for (const number of [...numbers].sort((left, right) => left - right)) {
    if (number < candidate) continue;
    if (number > candidate) break;
    candidate += 1;
  }
  return candidate;
}
