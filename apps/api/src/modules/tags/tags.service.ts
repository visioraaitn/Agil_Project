import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateTagInput, TagSummary, UpdateTagInput } from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';

/** Tags techniques, définis au niveau du projet. */
@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId: string): Promise<TagSummary[]> {
    return this.prisma.tag.findMany({
      where: { projectId },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
  }

  create(projectId: string, input: CreateTagInput): Promise<TagSummary> {
    return this.prisma.tag.create({
      data: { projectId, name: input.name, color: input.color },
      select: { id: true, name: true, color: true },
    });
  }

  async update(projectId: string, tagId: string, input: UpdateTagInput): Promise<TagSummary> {
    await this.assertBelongsToProject(projectId, tagId);
    return this.prisma.tag.update({
      where: { id: tagId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
      select: { id: true, name: true, color: true },
    });
  }

  /** La suppression détache le tag de tous les tickets (cascade en base). */
  async remove(projectId: string, tagId: string): Promise<void> {
    await this.assertBelongsToProject(projectId, tagId);
    await this.prisma.tag.delete({ where: { id: tagId } });
  }

  private async assertBelongsToProject(projectId: string, tagId: string): Promise<void> {
    const tag = await this.prisma.tag.findFirst({
      where: { id: tagId, projectId },
      select: { id: true },
    });
    if (!tag) {
      throw new NotFoundException({
        code: 'TAG_NOT_FOUND',
        message: "Ce tag n'existe pas dans ce projet",
      });
    }
  }
}
