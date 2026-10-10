import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BacklogNode,
  BoardColumn,
  CreateWorkItemInput,
  MoveWorkItemInput,
  UpdateWorkItemInput,
  WorkItemDetail,
  WorkItemFilters,
  WorkItemStatus,
  WorkItemSummary,
  WorkItemSortBy,
  WorkItemType,
  BOARD_CARD_TYPES,
  STATUS_ROLLUP_CHILD_TYPES,
  canBeChildOf,
  deriveParentStatus,
  REQUIRES_PARENT,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { BoardColumnsService } from './board-columns.service';
import { RankingService } from './ranking.service';
import { renumberSiblings } from './work-item-numbering';
import {
  ChildAggregate,
  WORK_ITEM_DETAIL_SELECT,
  WORK_ITEM_KEY_SELECT,
  WORK_ITEM_SUMMARY_SELECT,
  WorkItemSummaryRow,
  toWorkItemDetail,
  toWorkItemSummary,
  workItemKey,
} from './work-item.mapper';

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ranking: RankingService,
    private readonly boardColumns: BoardColumnsService,
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

  /**
   * D.1 · Task Board : sous-tâches et bugs répartis dans les colonnes configurées du projet,
   * dans leur ordre d'affichage. Chaque ticket est résolu vers UNE seule
   * colonne (voir BoardColumnsService), y compris quand plusieurs colonnes
   * partagent un même statut.
   */
  async getBoard(projectId: string, filters: WorkItemFilters): Promise<BoardColumn[]> {
    const [rows, resolver] = await Promise.all([
      this.prisma.workItem.findMany({
        where: {
          ...this.buildWhere(projectId, filters),
          // Task Board : les cartes sont les sous-tâches et les bugs ; leurs
          // User Stories (et les Epics qui les regroupent) forment les lignes.
          type: { in: [...BOARD_CARD_TYPES] },
        },
        select: WORK_ITEM_SUMMARY_SELECT,
        orderBy: this.buildOrderBy(filters, 'board'),
      }),
      this.boardColumns.resolver(projectId),
    ]);

    const aggregates = this.computeAggregates(rows);
    const itemsByColumn = new Map<string, WorkItemSummary[]>(
      resolver.columns.map((column) => [column.id, []]),
    );
    for (const row of rows) {
      const item = toWorkItemSummary(row, aggregates.get(row.id));
      itemsByColumn.get(resolver.resolve(item).id)?.push(item);
    }

    return resolver.columns.map((column) => {
      const columnItems = itemsByColumn.get(column.id) ?? [];
      return {
        ...column,
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
    await this.assertReferences(
      projectId,
      assigneeIds,
      input.sprintId,
      input.labelIds,
      input.tagIds,
    );
    const sprintId = await this.inheritSprintId(input.parentId ?? null, input.sprintId);

    const targetStatus = input.status ?? WorkItemStatus.TODO;

    const { rank, boardRank } = await this.ranking.initialRanks(
      projectId,
      input.parentId ?? null,
      targetStatus,
    );

    /** Le numero est alloue dans la portee type/parent avec protection concurrente. */
    const created = await this.numberedTransaction(async (tx) => {
      await renumberSiblings(tx, projectId, input.type, input.parentId ?? null);
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
          sprintId,
          startDate: input.startDate ?? null,
          dueDate: input.dueDate ?? null,
          reporterId,
          rank,
          boardRank,
          ...(targetStatus === WorkItemStatus.DONE ? { closedAt: new Date() } : {}),
          ...(input.labelIds?.length
            ? { labels: { create: input.labelIds.map((labelId) => ({ labelId })) } }
            : {}),
          ...(input.tagIds?.length
            ? { tags: { create: input.tagIds.map((tagId) => ({ tagId })) } }
            : {}),
          ...(assigneeIds.length
            ? { assignees: { create: assigneeIds.map((userId) => ({ userId })) } }
            : {}),
        },
        select: { id: true },
      });
    });

    await this.syncParentStatus(input.parentId ?? null);
    return this.getById(projectId, created.id);
  }

  async update(
    projectId: string,
    itemId: string,
    input: UpdateWorkItemInput,
  ): Promise<WorkItemDetail> {
    const existing = await this.prisma.workItem.findFirst({
      where: { id: itemId, projectId, deletedAt: null },
      select: { id: true, type: true, status: true, parentId: true, sprintId: true },
    });
    if (!existing) throw this.notFound();

    const changesParent = input.parentId !== undefined && input.parentId !== existing.parentId;
    const targetParentId = input.parentId !== undefined ? input.parentId : existing.parentId;
    if (changesParent) {
      await this.assertHierarchy(projectId, existing.type as WorkItemType, targetParentId);
      await this.assertNoCycle(itemId, targetParentId);
    }

    const assigneeIds = resolveAssigneeIds(input);
    await this.assertReferences(
      projectId,
      assigneeIds,
      input.sprintId,
      input.labelIds,
      input.tagIds,
    );

    // C.1 · Un Epic propage son sprint à ses descendants — jamais silencieusement
    // si certains sont déjà affectés ailleurs (voir assertNoSprintConflict).
    const changesEpicSprint =
      existing.type === WorkItemType.EPIC &&
      input.sprintId !== undefined &&
      input.sprintId !== existing.sprintId;

    // C.1 · Rattaché à un parent planifié, un ticket resté sans sprint suit ce
    // sprint. Un sprint déjà choisi n'est jamais écrasé (pas de déplacement silencieux).
    const requestedSprintId = input.sprintId !== undefined ? input.sprintId : existing.sprintId;
    const inheritedSprintId =
      changesParent && !requestedSprintId && input.sprintId === undefined
        ? await this.inheritSprintId(targetParentId, undefined)
        : null;

    const closesNow =
      input.status === WorkItemStatus.DONE && existing.status !== WorkItemStatus.DONE;
    const reopens = input.status !== undefined && input.status !== WorkItemStatus.DONE;
    const targetRank = changesParent
      ? await this.ranking.computeRank('rank', {}, { projectId, parentId: targetParentId })
      : undefined;

    const updateInTransaction = async (tx: Prisma.TransactionClient) => {
      if (changesEpicSprint) {
        await this.assertNoSprintConflict(
          tx,
          itemId,
          input.sprintId ?? null,
          input.confirmSprintPropagation ?? false,
        );
      }

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
          ...(inheritedSprintId ? { sprintId: inheritedSprintId } : {}),
          // Un changement de statut hors board (détail, PR…) ramène le ticket
          // dans la colonne par défaut de son nouveau statut.
          ...(input.status !== undefined && input.status !== existing.status
            ? { boardColumnId: null }
            : {}),
          ...(closesNow ? { closedAt: new Date() } : {}),
          ...(reopens ? { closedAt: null } : {}),
        },
      });

      if (changesParent) {
        await renumberSiblings(tx, projectId, existing.type, existing.parentId);
        await renumberSiblings(tx, projectId, existing.type, targetParentId);
      }

      if (closesNow) {
        await this.cascadeCloseDescendants(tx, itemId);
      }

      if (changesEpicSprint) {
        await this.cascadeSprintToDescendants(tx, itemId, input.sprintId ?? null);
      }

      if (inheritedSprintId) {
        await this.fillSprintOnUnplannedDescendants(tx, itemId, inheritedSprintId);
      }

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

      // Les tags techniques sont remplacés en bloc.
      if (input.tagIds) {
        await tx.workItemTag.deleteMany({ where: { workItemId: itemId } });
        if (input.tagIds.length > 0) {
          await tx.workItemTag.createMany({
            data: input.tagIds.map((tagId) => ({ workItemId: itemId, tagId })),
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

    if (input.status !== undefined || changesParent) {
      await this.syncParentStatus(existing.parentId);
      if (changesParent) await this.syncParentStatus(targetParentId);
    }

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
      select: { id: true, type: true, status: true, parentId: true, sprintId: true },
    });
    if (!item) throw this.notFound();

    await this.assertReferences(projectId, undefined, input.sprintId);
    const changesEpicSprint =
      item.type === WorkItemType.EPIC &&
      input.sprintId !== undefined &&
      input.sprintId !== item.sprintId;

    const parentProvided = input.parentId !== undefined;
    const targetParentId = parentProvided ? (input.parentId ?? null) : item.parentId;
    const changesParent = parentProvided && targetParentId !== item.parentId;

    if (changesParent) {
      await this.assertHierarchy(projectId, item.type as WorkItemType, targetParentId);
      await this.assertNoCycle(itemId, targetParentId);
    }

    const data: Prisma.WorkItemUpdateInput = {};
    let closesNow = false;

    // La colonne de destination fixe le statut ; une colonne par défaut se
    // traduit par `boardColumnId = null` (le statut suffit à la retrouver).
    const targetColumn = input.columnId
      ? await this.boardColumns.findForMove(projectId, input.columnId)
      : null;
    const requestedStatus = targetColumn?.status ?? input.status;

    // Déplacement de colonne : on recalcule le rang board.
    if (
      requestedStatus !== undefined ||
      input.beforeId !== undefined ||
      input.afterId !== undefined
    ) {
      const targetStatus = requestedStatus ?? (item.status as WorkItemStatus);
      const isBoardMove = requestedStatus !== undefined;

      if (isBoardMove) {
        closesNow = targetStatus === WorkItemStatus.DONE && item.status !== WorkItemStatus.DONE;
        data.status = targetStatus;
        data.closedAt = targetStatus === WorkItemStatus.DONE ? new Date() : null;
        data.boardColumn =
          targetColumn && !targetColumn.isDefault
            ? { connect: { id: targetColumn.id } }
            : { disconnect: true };
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
      if (data.rank === undefined && requestedStatus === undefined) {
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

    const inheritedSprintId =
      changesParent && input.sprintId === undefined && !item.sprintId
        ? await this.inheritSprintId(targetParentId, undefined)
        : null;
    if (inheritedSprintId) data.sprint = { connect: { id: inheritedSprintId } };

    const applyMove = async (tx: Prisma.TransactionClient) => {
      if (changesEpicSprint) {
        await this.assertNoSprintConflict(
          tx,
          itemId,
          input.sprintId ?? null,
          input.confirmSprintPropagation ?? false,
        );
      }
      const number = changesParent
        ? await this.nextAvailableNumber(tx, projectId, item.type as WorkItemType, targetParentId)
        : undefined;
      await tx.workItem.update({
        where: { id: itemId },
        data: { ...data, ...(changesParent ? { number } : {}) },
      });
      if (changesParent) await renumberSiblings(tx, projectId, item.type, item.parentId);
      if (changesParent || data.rank !== undefined) {
        await renumberSiblings(tx, projectId, item.type, targetParentId);
      }
      if (closesNow) await this.cascadeCloseDescendants(tx, itemId);
      if (changesEpicSprint)
        await this.cascadeSprintToDescendants(tx, itemId, input.sprintId ?? null);
      if (inheritedSprintId)
        await this.fillSprintOnUnplannedDescendants(tx, itemId, inheritedSprintId);
    };
    if (changesParent || data.rank !== undefined) {
      await this.numberedTransaction(applyMove);
    } else if (closesNow || changesEpicSprint) {
      await this.prisma.$transaction(applyMove);
    } else {
      await this.prisma.workItem.update({ where: { id: itemId }, data });
    }

    if (requestedStatus !== undefined || changesParent) {
      await this.syncParentStatus(item.parentId);
      if (changesParent) await this.syncParentStatus(targetParentId);
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
      select: { id: true, type: true, parentId: true },
    });
    if (!item) throw this.notFound();

    await this.numberedTransaction(async (tx) => {
      const ids = await this.collectDescendants(itemId, tx);
      await tx.workItem.updateMany({
        where: { id: { in: ids } },
        data: { deletedAt: new Date() },
      });
      await renumberSiblings(tx, projectId, item.type, item.parentId);
    });
    await this.syncParentStatus(item.parentId);
  }

  // --- Règles et utilitaires ---------------------------------------------

  /**
   * D.1 · Le statut d'un parent suit ses enfants — voir `deriveParentStatus` :
   * une User Story suit ses cartes (sous-tâches et bugs), un Epic ses User
   * Stories. Appelé après chaque création, modification, déplacement ou
   * suppression d'un enfant ; un parent qui change à son tour fait remonter la
   * règle à son propre parent (carte → Story → Epic). Un statut posé à la main
   * n'est jamais écrasé tant qu'aucun enfant ne bouge.
   */
  private async syncParentStatus(parentId: string | null): Promise<void> {
    if (!parentId) return;
    const grandParentId = await this.prisma.$transaction(async (tx) => {
      const parent = await tx.workItem.findFirst({
        where: { id: parentId, deletedAt: null },
        select: { type: true, status: true, parentId: true },
      });
      const childTypes = parent
        ? STATUS_ROLLUP_CHILD_TYPES[parent.type as WorkItemType]
        : undefined;
      if (!parent || !childTypes) return null;

      const children = await tx.workItem.findMany({
        where: { parentId, deletedAt: null, type: { in: [...childTypes] } },
        select: { status: true },
      });
      const target = deriveParentStatus(
        parent.status as WorkItemStatus,
        children.map((child) => child.status as WorkItemStatus),
      );
      if (!target) return null;

      await tx.workItem.update({
        where: { id: parentId },
        data: {
          status: target,
          closedAt: target === WorkItemStatus.DONE ? new Date() : null,
          // Statut changé hors board : le ticket retrouve la colonne par défaut.
          boardColumnId: null,
        },
      });
      return parent.parentId;
    });
    // Le parent a changé : son propre parent (l'Epic d'une Story) suit à son tour.
    if (grandParentId) await this.syncParentStatus(grandParentId);
  }

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
      ...(filters.tagId ? { tags: { some: { tagId: filters.tagId } } } : {}),
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

    if (!field) return [{ [stableColumn]: 'asc' }, { id: 'asc' }];

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
          message: 'Une sous-tâche ou un bug doit être rattaché à une user story',
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

  /**
   * Identifiants du ticket et de toute sa descendance. `client` permet de
   * lire à l'intérieur d'une transaction en cours (ex. fermeture en cascade)
   * plutôt qu'avec une connexion séparée.
   */
  private async collectDescendants(
    itemId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string[]> {
    const collected = [itemId];
    let frontier = [itemId];

    // La hiérarchie est bornée à 3 niveaux ; la boucle reste courte.
    while (frontier.length > 0) {
      const children = await client.workItem.findMany({
        where: { parentId: { in: frontier }, deletedAt: null },
        select: { id: true },
      });
      frontier = children.map((child) => child.id);
      collected.push(...frontier);
    }

    return collected;
  }

  /**
   * D.1/C.1 · Fermeture en cascade : quand un ticket passe à `DONE`, tous ses
   * descendants encore ouverts passent aussi à `DONE`, dans la même
   * transaction que la mise à jour du parent. Ne dépend pas du type du ticket
   * appelant : une sous-tâche n'a pas de descendant, l'appel est alors un
   * no-op — pas besoin de condition sur le type avant d'appeler cette méthode.
   */
  private async cascadeCloseDescendants(
    tx: Prisma.TransactionClient,
    itemId: string,
  ): Promise<void> {
    const descendantIds = (await this.collectDescendants(itemId, tx)).filter((id) => id !== itemId);
    if (descendantIds.length === 0) return;

    await tx.workItem.updateMany({
      where: { id: { in: descendantIds }, status: { not: WorkItemStatus.DONE } },
      data: { status: WorkItemStatus.DONE, closedAt: new Date() },
    });
  }

  /**
   * C.1 · Refuse une propagation Epic → Sprint silencieuse : si des
   * descendants sont déjà affectés à un AUTRE sprint que la cible, la requête
   * échoue avec la liste des conflits tant que le client n'a pas confirmé.
   * Rien n'est modifié dans ce cas (le throw annule toute la transaction).
   */
  private async assertNoSprintConflict(
    tx: Prisma.TransactionClient,
    itemId: string,
    targetSprintId: string | null,
    confirmed: boolean,
  ): Promise<void> {
    if (confirmed) return;

    const descendantIds = (await this.collectDescendants(itemId, tx)).filter((id) => id !== itemId);
    if (descendantIds.length === 0) return;

    const descendants = await tx.workItem.findMany({
      where: { id: { in: descendantIds }, deletedAt: null },
      select: {
        id: true,
        title: true,
        sprintId: true,
        sprint: { select: { name: true } },
        ...WORK_ITEM_KEY_SELECT,
        project: { select: { key: true } },
      },
    });

    const conflicts = descendants.filter(
      (descendant) => descendant.sprintId !== null && descendant.sprintId !== targetSprintId,
    );
    if (conflicts.length === 0) return;

    throw new BadRequestException({
      code: 'SPRINT_PROPAGATION_CONFIRMATION_REQUIRED',
      message:
        'Des éléments de cet Epic sont déjà affectés à un autre sprint — confirmez le déplacement',
      details: {
        conflicts: conflicts.map((descendant) => ({
          id: descendant.id,
          key: workItemKey(descendant.project.key, descendant),
          title: descendant.title,
          type: descendant.type as WorkItemType,
          currentSprintId: descendant.sprintId as string,
          currentSprintName: descendant.sprint?.name ?? '',
        })),
      },
    });
  }

  /**
   * C.1 · Sprint effectif d'un ticket : celui demandé explicitement, sinon
   * celui de son parent direct. Un enfant créé sous un Epic déjà planifié
   * rejoint donc son sprint au lieu de rester au backlog.
   */
  private async inheritSprintId(
    parentId: string | null,
    requestedSprintId: string | null | undefined,
  ): Promise<string | null> {
    if (requestedSprintId !== undefined || !parentId) return requestedSprintId ?? null;
    const parent = await this.prisma.workItem.findUnique({
      where: { id: parentId },
      select: { sprintId: true },
    });
    return parent?.sprintId ?? null;
  }

  /** Complète le sprint des descendants qui n'en ont pas, sans écraser un choix existant. */
  private async fillSprintOnUnplannedDescendants(
    tx: Prisma.TransactionClient,
    itemId: string,
    sprintId: string,
  ): Promise<void> {
    const descendantIds = (await this.collectDescendants(itemId, tx)).filter((id) => id !== itemId);
    if (descendantIds.length === 0) return;

    await tx.workItem.updateMany({
      where: { id: { in: descendantIds }, sprintId: null },
      data: { sprintId },
    });
  }

  /** C.1 · Applique le sprint de l'Epic à tous ses descendants, dans la même transaction. */
  private async cascadeSprintToDescendants(
    tx: Prisma.TransactionClient,
    itemId: string,
    sprintId: string | null,
  ): Promise<void> {
    const descendantIds = (await this.collectDescendants(itemId, tx)).filter((id) => id !== itemId);
    if (descendantIds.length === 0) return;

    await tx.workItem.updateMany({
      where: { id: { in: descendantIds } },
      data: { sprintId },
    });
  }

  private async assertReferences(
    projectId: string,
    assigneeIds?: string[],
    sprintId?: string | null,
    labelIds?: string[],
    tagIds?: string[],
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

    if (tagIds?.length) {
      const count = await this.prisma.tag.count({
        where: { projectId, id: { in: tagIds } },
      });
      if (count !== new Set(tagIds).size) {
        throw new BadRequestException({
          code: 'TAG_NOT_FOUND',
          message: 'Un tag référencé n’appartient pas au projet',
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
