import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateLabelInput, LabelSummary, UpdateLabelInput } from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';

/** C.2 · Étiquettes, définies au niveau du projet. */
@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  list(projectId: string): Promise<LabelSummary[]> {
    return this.prisma.label.findMany({
      where: { projectId },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
  }

  create(projectId: string, input: CreateLabelInput): Promise<LabelSummary> {
    return this.prisma.label.create({
      data: { projectId, name: input.name, color: input.color },
      select: { id: true, name: true, color: true },
    });
  }

  async update(projectId: string, labelId: string, input: UpdateLabelInput): Promise<LabelSummary> {
    await this.assertBelongsToProject(projectId, labelId);
    return this.prisma.label.update({
      where: { id: labelId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
      select: { id: true, name: true, color: true },
    });
  }

  /** La suppression détache l'étiquette de tous les tickets (cascade en base). */
  async remove(projectId: string, labelId: string): Promise<void> {
    await this.assertBelongsToProject(projectId, labelId);
    await this.prisma.label.delete({ where: { id: labelId } });
  }

  private async assertBelongsToProject(projectId: string, labelId: string): Promise<void> {
    const label = await this.prisma.label.findFirst({
      where: { id: labelId, projectId },
      select: { id: true },
    });
    if (!label) {
      throw new NotFoundException({
        code: 'LABEL_NOT_FOUND',
        message: "Cette étiquette n'existe pas dans ce projet",
      });
    }
  }
}
