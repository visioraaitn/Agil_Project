import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CloseSprintInput,
  CreateSprintInput,
  ListSprintsQuery,
  RoadmapEpic,
  SprintDateIssue,
  SprintDetail,
  SprintStatus,
  startOfUtcDay,
  UnfinishedItemsAction,
  UpdateRetrospectiveInput,
  UpdateSprintInput,
  WorkItemStatus,
  WorkItemType,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { WORK_ITEM_SUMMARY_SELECT, toWorkItemSummary } from '../work-items/work-item.mapper';
import {
  SPRINT_DETAIL_SELECT,
  SPRINT_SUMMARY_SELECT,
  toSprintDetail,
  toSprintSummary,
} from './sprint.mapper';

@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    projectId: string,
    query: ListSprintsQuery,
  ): Promise<ReturnType<typeof toSprintSummary>[]> {
    const rows = await this.prisma.sprint.findMany({
      where: { projectId, ...(query.status ? { status: query.status } : {}) },
      select: SPRINT_SUMMARY_SELECT,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toSprintSummary);
  }

  async getById(projectId: string, sprintId: string): Promise<SprintDetail> {
    const row = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: SPRINT_DETAIL_SELECT,
    });
    if (!row) throw this.notFound();
    return toSprintDetail(row);
  }

  async create(projectId: string, input: CreateSprintInput): Promise<SprintDetail> {
    this.assertNotInPast(input.startDate, SprintDateIssue.START_IN_PAST);
    await this.assertNoDateOverlap(projectId, input.startDate, input.endDate);

    const sprint = await this.prisma.sprint.create({
      data: {
        projectId,
        name: input.name,
        goal: input.goal ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        status: SprintStatus.PLANNED,
      },
      select: { id: true },
    });

    return this.getById(projectId, sprint.id);
  }

  async update(
    projectId: string,
    sprintId: string,
    input: UpdateSprintInput,
  ): Promise<SprintDetail> {
    const existing = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: { id: true, status: true, startDate: true, endDate: true },
    });
    if (!existing) throw this.notFound();
    if (existing.status === SprintStatus.COMPLETED) {
      throw new BadRequestException({
        code: 'SPRINT_ALREADY_CLOSED',
        message: 'Un sprint cloture ne peut plus etre modifie',
      });
    }

    // Seules les dates modifiées sont contrôlées : un sprint actif commencé hier
    // reste modifiable (nom, objectif, prolongation) sans toucher à son début.
    const startDate = input.startDate ?? existing.startDate;
    const endDate = input.endDate ?? existing.endDate;
    const changesStart = !sameDay(startDate, existing.startDate);
    const changesEnd = !sameDay(endDate, existing.endDate);
    if (startDate > endDate) {
      throw new BadRequestException({
        code: 'SPRINT_INVALID_DATES',
        message: 'La date de fin doit etre posterieure a la date de debut',
      });
    }
    if (changesStart) this.assertNotInPast(startDate, SprintDateIssue.START_IN_PAST);
    if (changesEnd) this.assertNotInPast(endDate, SprintDateIssue.END_IN_PAST);
    if (changesStart || changesEnd) {
      await this.assertNoDateOverlap(projectId, startDate, endDate, sprintId);
    }

    if (input.status === SprintStatus.ACTIVE) {
      const activeSprint = await this.prisma.sprint.findFirst({
        where: { projectId, status: SprintStatus.ACTIVE, id: { not: sprintId } },
        select: { id: true },
      });
      if (activeSprint) {
        throw new BadRequestException({
          code: 'ACTIVE_SPRINT_EXISTS',
          message: 'Clôturez le sprint actif avant d’en démarrer un autre',
        });
      }
    }

    await this.prisma.sprint.update({
      where: { id: sprintId },
      data: pick(input, ['name', 'goal', 'startDate', 'endDate', 'status']),
    });
    return this.getById(projectId, sprintId);
  }

  async close(projectId: string, sprintId: string, input: CloseSprintInput): Promise<SprintDetail> {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: { id: true, status: true },
    });
    if (!sprint) throw this.notFound();
    if (sprint.status === SprintStatus.COMPLETED) {
      throw new BadRequestException({
        code: 'SPRINT_ALREADY_CLOSED',
        message: 'Ce sprint est deja cloture',
      });
    }

    if (input.targetSprintId) {
      if (input.targetSprintId === sprintId) {
        throw new BadRequestException({
          code: 'INVALID_TARGET_SPRINT',
          message: 'Le sprint de destination doit etre different du sprint cloture',
        });
      }
      const target = await this.prisma.sprint.findFirst({
        where: { id: input.targetSprintId, projectId },
        select: { status: true },
      });
      if (!target) {
        throw new BadRequestException({
          code: 'INVALID_TARGET_SPRINT',
          message: "Ce sprint de destination n'appartient pas au projet",
        });
      }
      if (target.status === SprintStatus.COMPLETED) {
        throw new BadRequestException({
          code: 'INVALID_TARGET_SPRINT',
          message: 'Le sprint de destination ne peut pas etre deja cloture',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Tous les types de tickets peuvent porter un sprintId (pas seulement les stories) :
      // un bug ou une sous-tache encore ouverte doit aussi pouvoir etre reportee.
      const items = await tx.workItem.findMany({
        where: { projectId, sprintId, deletedAt: null },
        select: { id: true, storyPoints: true, status: true },
      });
      const committedPoints = items.reduce((total, item) => total + (item.storyPoints ?? 0), 0);
      const unfinished = items.filter((item) => item.status !== WorkItemStatus.DONE);
      const completedPoints =
        committedPoints - unfinished.reduce((total, item) => total + (item.storyPoints ?? 0), 0);

      if (unfinished.length > 0 && !input.unfinishedItemsAction) {
        throw new BadRequestException({
          code: 'UNFINISHED_ITEMS_ACTION_REQUIRED',
          message:
            'Choisissez quoi faire des elements non termines : les deplacer vers un sprint ou les remettre au backlog',
        });
      }

      if (
        unfinished.length > 0 &&
        input.unfinishedItemsAction === UnfinishedItemsAction.MOVE_TO_SPRINT
      ) {
        await tx.workItem.updateMany({
          where: { id: { in: unfinished.map((item) => item.id) } },
          data: { sprintId: input.targetSprintId },
        });
      } else if (
        unfinished.length > 0 &&
        input.unfinishedItemsAction === UnfinishedItemsAction.BACKLOG
      ) {
        // Ne touche jamais parentId : seule l'affectation au sprint change, la hiérarchie reste intacte.
        await tx.workItem.updateMany({
          where: { id: { in: unfinished.map((item) => item.id) } },
          data: { sprintId: null },
        });
      }

      await tx.sprint.update({
        where: { id: sprintId },
        data: {
          status: SprintStatus.COMPLETED,
          committedPoints,
          completedPoints,
          closedAt: new Date(),
          retroSummary: input.retroSummary ?? undefined,
        },
      });
    });

    return this.getById(projectId, sprintId);
  }

  async updateRetrospective(
    projectId: string,
    sprintId: string,
    input: UpdateRetrospectiveInput,
    authorId: string,
  ): Promise<SprintDetail> {
    await this.assertExists(projectId, sprintId);

    await this.prisma.$transaction(async (tx) => {
      await tx.sprint.update({
        where: { id: sprintId },
        data: { retroSummary: input.retroSummary ?? null },
      });
      await tx.retrospectiveItem.deleteMany({ where: { sprintId } });
      if (input.items.length > 0) {
        await tx.retrospectiveItem.createMany({
          data: input.items.map((item) => ({
            sprintId,
            category: item.category,
            content: item.content,
            isDone: item.isDone,
            authorId,
          })),
        });
      }
    });

    return this.getById(projectId, sprintId);
  }

  async roadmap(projectId: string): Promise<RoadmapEpic[]> {
    const rows = await this.prisma.workItem.findMany({
      where: { projectId, deletedAt: null, type: WorkItemType.EPIC },
      select: WORK_ITEM_SUMMARY_SELECT,
      orderBy: [{ startDate: 'asc' }, { dueDate: 'asc' }, { rank: 'asc' }],
    });
    const children = await this.prisma.workItem.findMany({
      where: { projectId, deletedAt: null, parentId: { in: rows.map((row) => row.id) } },
      select: { parentId: true, status: true, storyPoints: true },
    });

    return rows.map((row) => {
      const epicChildren = children.filter((child) => child.parentId === row.id);
      const summary = toWorkItemSummary(row, {
        childCount: epicChildren.length,
        doneChildCount: epicChildren.filter((child) => child.status === WorkItemStatus.DONE).length,
        rolledUpPoints: epicChildren.reduce((total, child) => total + (child.storyPoints ?? 0), 0),
      });
      return {
        id: summary.id,
        key: summary.key,
        title: summary.title,
        status: summary.status,
        startDate: summary.startDate,
        dueDate: summary.dueDate,
        childCount: summary.childCount,
        doneChildCount: summary.doneChildCount,
        rolledUpPoints: summary.rolledUpPoints,
      };
    });
  }

  private async assertExists(projectId: string, sprintId: string): Promise<void> {
    const exists = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: { id: true },
    });
    if (!exists) throw this.notFound();
  }

  /** Un sprint ne se planifie pas dans le passé : la date doit être aujourd'hui ou après. */
  private assertNotInPast(date: Date, code: SprintDateIssue): void {
    if (startOfUtcDay(date) < startOfUtcDay()) {
      throw new BadRequestException({
        code,
        message:
          code === SprintDateIssue.START_IN_PAST
            ? "La date de début doit être aujourd'hui ou plus tard"
            : "La date de fin doit être aujourd'hui ou plus tard",
      });
    }
  }

  /** Deux sprints d'un projet ne partagent aucun jour, quel que soit leur statut. */
  private async assertNoDateOverlap(
    projectId: string,
    startDate: Date,
    endDate: Date,
    exceptSprintId?: string,
  ): Promise<void> {
    const overlap = await this.prisma.sprint.findFirst({
      where: {
        projectId,
        ...(exceptSprintId ? { id: { not: exceptSprintId } } : {}),
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { name: true, startDate: true, endDate: true },
      orderBy: { startDate: 'asc' },
    });
    if (overlap) {
      throw new BadRequestException({
        code: SprintDateIssue.OVERLAP,
        message: `Ces dates chevauchent le sprint « ${overlap.name} » (${formatDay(overlap.startDate)} – ${formatDay(overlap.endDate)})`,
      });
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: 'SPRINT_NOT_FOUND', message: "Ce sprint n'existe pas" });
  }
}

function sameDay(a: Date, b: Date): boolean {
  return startOfUtcDay(a).getTime() === startOfUtcDay(b).getTime();
}

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

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
