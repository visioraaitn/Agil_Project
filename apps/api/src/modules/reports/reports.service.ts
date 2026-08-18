import { Injectable } from '@nestjs/common';
import {
  BOARD_COLUMNS,
  CalendarEvent,
  ProjectDashboard,
  SearchResult,
  SprintStatus,
  WorkItemStatus,
  WorkItemType,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { WORK_ITEM_SUMMARY_SELECT, toWorkItemSummary, workItemKey } from '../work-items/work-item.mapper';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(projectId: string): Promise<ProjectDashboard> {
    const [items, sprints, activeSprint, blockedRows] = await Promise.all([
      this.prisma.workItem.findMany({
        where: { projectId, deletedAt: null, type: { not: WorkItemType.EPIC } },
        select: { status: true, storyPoints: true, isBlocked: true },
      }),
      this.prisma.sprint.findMany({
        where: { projectId, status: SprintStatus.COMPLETED },
        select: { id: true, name: true, committedPoints: true, completedPoints: true },
        orderBy: { endDate: 'asc' },
        take: 8,
      }),
      this.prisma.sprint.findFirst({
        where: { projectId, status: SprintStatus.ACTIVE },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          snapshots: {
            select: { date: true, remainingPoints: true, completedPoints: true },
            orderBy: { date: 'asc' },
          },
          workItems: { where: { deletedAt: null }, select: { status: true, storyPoints: true } },
        },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.workItem.findMany({
        where: { projectId, deletedAt: null, isBlocked: true },
        select: WORK_ITEM_SUMMARY_SELECT,
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ]);

    const totalItems = items.length;
    const completedItems = items.filter((item) => item.status === WorkItemStatus.DONE).length;
    const totalPoints = items.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
    const completedPoints = items
      .filter((item) => item.status === WorkItemStatus.DONE)
      .reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);

    return {
      metrics: [
        { label: 'Tickets', value: totalItems, hint: `${completedItems} termines` },
        { label: 'Points', value: totalPoints, hint: `${completedPoints} termines` },
        { label: 'Bloques', value: items.filter((item) => item.isBlocked).length, hint: null },
        {
          label: 'Avancement',
          value: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
          hint: '% tickets termines',
        },
      ],
      statusDistribution: BOARD_COLUMNS.map((status) => {
        const rows = items.filter((item) => item.status === status);
        return {
          status,
          count: rows.length,
          points: rows.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0),
        };
      }),
      velocity: sprints.map((sprint) => ({
        sprintId: sprint.id,
        sprintName: sprint.name,
        committedPoints: sprint.committedPoints ?? 0,
        completedPoints: sprint.completedPoints ?? 0,
      })),
      burndown: this.toBurndown(activeSprint),
      blockedItems: blockedRows.map((row) => toWorkItemSummary(row)),
    };
  }

  async calendar(projectId: string): Promise<CalendarEvent[]> {
    const [sprints, milestones, workItems] = await Promise.all([
      this.prisma.sprint.findMany({
        where: { projectId },
        select: { id: true, name: true, startDate: true, endDate: true, status: true },
        orderBy: { startDate: 'asc' },
      }),
      this.prisma.milestone.findMany({
        where: { projectId },
        select: { id: true, name: true, date: true, isReached: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.workItem.findMany({
        where: { projectId, deletedAt: null, dueDate: { not: null } },
        select: { id: true, number: true, title: true, dueDate: true, status: true, project: { select: { key: true } } },
        orderBy: { dueDate: 'asc' },
        take: 100,
      }),
    ]);

    return [
      ...sprints.map((sprint) => ({
        id: sprint.id,
        type: 'SPRINT' as const,
        title: sprint.name,
        start: sprint.startDate.toISOString(),
        end: sprint.endDate.toISOString(),
        status: sprint.status as SprintStatus,
      })),
      ...milestones.map((milestone) => ({
        id: milestone.id,
        type: 'MILESTONE' as const,
        title: milestone.name,
        start: milestone.date.toISOString(),
        end: null,
        status: milestone.isReached ? WorkItemStatus.DONE : null,
      })),
      ...workItems.map((item) => ({
        id: item.id,
        type: 'WORK_ITEM' as const,
        title: `${workItemKey(item.project.key, item.number)} · ${item.title}`,
        start: item.dueDate?.toISOString() ?? new Date().toISOString(),
        end: null,
        status: item.status as WorkItemStatus,
      })),
    ].sort((a, b) => a.start.localeCompare(b.start));
  }

  async search(userId: string, query: string): Promise<SearchResult[]> {
    const [projects, workItems, sprints, pullRequests] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          OR: [{ members: { some: { userId } } }, { createdById: userId }],
          name: { contains: query, mode: 'insensitive' },
        },
        select: { id: true, key: true, name: true, company: true, status: true },
        take: 8,
      }),
      this.prisma.workItem.findMany({
        where: {
          deletedAt: null,
          project: { members: { some: { userId } } },
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, number: true, title: true, status: true, project: { select: { key: true } } },
        take: 12,
      }),
      this.prisma.sprint.findMany({
        where: {
          project: { members: { some: { userId } } },
          name: { contains: query, mode: 'insensitive' },
        },
        select: { id: true, name: true, status: true, project: { select: { key: true } } },
        take: 6,
      }),
      this.prisma.pullRequest.findMany({
        where: {
          workItem: { project: { members: { some: { userId } } } },
          title: { contains: query, mode: 'insensitive' },
        },
        select: {
          id: true,
          title: true,
          status: true,
          workItem: { select: { project: { select: { key: true } } } },
          repository: { select: { name: true } },
        },
        take: 6,
      }),
    ]);

    return [
      ...projects.map((project) => ({
        id: project.id,
        type: 'PROJECT' as const,
        title: project.name,
        subtitle: project.company,
        url: `/projects/${project.key}/overview`,
        projectKey: project.key,
        status: project.status,
      })),
      ...workItems.map((item) => ({
        id: item.id,
        type: 'WORK_ITEM' as const,
        title: `${workItemKey(item.project.key, item.number)} · ${item.title}`,
        subtitle: 'Ticket',
        url: `/projects/${item.project.key}/backlog`,
        projectKey: item.project.key,
        status: item.status,
      })),
      ...sprints.map((sprint) => ({
        id: sprint.id,
        type: 'SPRINT' as const,
        title: sprint.name,
        subtitle: 'Sprint',
        url: `/projects/${sprint.project.key}/sprints`,
        projectKey: sprint.project.key,
        status: sprint.status,
      })),
      ...pullRequests.map((pr) => ({
        id: pr.id,
        type: 'PULL_REQUEST' as const,
        title: pr.title,
        subtitle: pr.repository.name,
        url: `/projects/${pr.workItem.project.key}/repos`,
        projectKey: pr.workItem.project.key,
        status: pr.status,
      })),
    ];
  }

  private toBurndown(
    sprint: {
      startDate: Date;
      endDate: Date;
      snapshots: { date: Date; remainingPoints: number; completedPoints: number }[];
      workItems: { status: string; storyPoints: number | null }[];
    } | null,
  ) {
    if (!sprint) return [];
    if (sprint.snapshots.length > 0) {
      return sprint.snapshots.map((snapshot) => ({
        date: snapshot.date.toISOString(),
        remainingPoints: snapshot.remainingPoints,
        completedPoints: snapshot.completedPoints,
      }));
    }
    const total = sprint.workItems.reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
    const completed = sprint.workItems
      .filter((item) => item.status === WorkItemStatus.DONE)
      .reduce((sum, item) => sum + (item.storyPoints ?? 0), 0);
    return [
      { date: sprint.startDate.toISOString(), remainingPoints: total, completedPoints: 0 },
      {
        date: new Date().toISOString(),
        remainingPoints: Math.max(total - completed, 0),
        completedPoints: completed,
      },
      { date: sprint.endDate.toISOString(), remainingPoints: 0, completedPoints: total },
    ];
  }
}
