import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CloseSprintInput,
  CreateSprintInput,
  ListSprintsQuery,
  RoadmapEpic,
  SprintDetail,
  SprintStatus,
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

  async list(projectId: string, query: ListSprintsQuery): Promise<ReturnType<typeof toSprintSummary>[]> {
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

  async update(projectId: string, sprintId: string, input: UpdateSprintInput): Promise<SprintDetail> {
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

    const startDate = input.startDate ?? existing.startDate;
    const endDate = input.endDate ?? existing.endDate;
    await this.assertNoDateOverlap(projectId, startDate, endDate, sprintId);

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

    const items = await this.prisma.workItem.findMany({
      where: { projectId, sprintId, deletedAt: null },
      select: { storyPoints: true, status: true },
    });
    const committedPoints = items.reduce((total, item) => total + (item.storyPoints ?? 0), 0);
    const completedPoints = items
      .filter((item) => item.status === WorkItemStatus.DONE)
      .reduce((total, item) => total + (item.storyPoints ?? 0), 0);

    await this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: SprintStatus.COMPLETED,
        committedPoints,
        completedPoints,
        closedAt: new Date(),
        retroSummary: input.retroSummary ?? undefined,
      },
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
        status: { not: SprintStatus.COMPLETED },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });
    if (overlap) {
      throw new BadRequestException({
        code: 'SPRINT_DATES_OVERLAP',
        message: 'Les dates chevauchent un sprint actif ou planifie',
      });
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({ code: 'SPRINT_NOT_FOUND', message: "Ce sprint n'existe pas" });
  }
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
