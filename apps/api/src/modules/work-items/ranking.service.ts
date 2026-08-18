import { BadRequestException, Injectable } from '@nestjs/common';
import { INITIAL_RANK, rankBetween } from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';

/** Champ d'ordonnancement visé : backlog (`rank`) ou board (`boardRank`). */
export type RankField = 'rank' | 'boardRank';

export interface RankNeighbours {
  beforeId?: string | null;
  afterId?: string | null;
}

/**
 * Calcule le rang d'un ticket déplacé.
 *
 * Le client envoie ses voisins (`beforeId` au-dessus, `afterId` en dessous) et
 * non un index : deux utilisateurs qui déplacent des cartes en même temps ne se
 * marchent pas dessus, et un seul UPDATE suffit.
 */
@Injectable()
export class RankingService {
  constructor(private readonly prisma: PrismaService) {}

  async computeRank(
    field: RankField,
    neighbours: RankNeighbours,
    /** Portée dans laquelle chercher la fin de liste quand aucun voisin n'est donné. */
    fallbackScope: { projectId: string; parentId?: string | null; status?: string },
  ): Promise<string> {
    const [before, after] = await Promise.all([
      this.rankOf(field, neighbours.beforeId),
      this.rankOf(field, neighbours.afterId),
    ]);

    if (before && after && before >= after) {
      throw new BadRequestException({
        code: 'INCONSISTENT_POSITION',
        message: 'La position demandée est incohérente, rechargez la vue',
      });
    }

    if (before || after) return rankBetween(before, after);

    // Aucun voisin : placement en fin de la liste ciblée.
    const last = await this.prisma.workItem.findFirst({
      where: {
        projectId: fallbackScope.projectId,
        deletedAt: null,
        ...(fallbackScope.parentId !== undefined ? { parentId: fallbackScope.parentId } : {}),
        ...(fallbackScope.status ? { status: fallbackScope.status as never } : {}),
      },
      orderBy: { [field]: 'desc' },
      select: { [field]: true } as { rank: true } | { boardRank: true },
    });

    const lastRank = last ? ((last as Record<string, string>)[field] ?? null) : null;
    return lastRank ? rankBetween(lastRank, null) : INITIAL_RANK;
  }

  /** Rang de départ d'un ticket créé : en tête de sa liste. */
  async initialRanks(
    projectId: string,
    parentId: string | null,
    status: string,
  ): Promise<{ rank: string; boardRank: string }> {
    const [firstBacklog, firstBoard] = await Promise.all([
      this.prisma.workItem.findFirst({
        where: { projectId, parentId, deletedAt: null },
        orderBy: { rank: 'asc' },
        select: { rank: true },
      }),
      this.prisma.workItem.findFirst({
        where: { projectId, status: status as never, deletedAt: null },
        orderBy: { boardRank: 'asc' },
        select: { boardRank: true },
      }),
    ]);

    return {
      rank: firstBacklog ? rankBetween(null, firstBacklog.rank) : INITIAL_RANK,
      boardRank: firstBoard ? rankBetween(null, firstBoard.boardRank) : INITIAL_RANK,
    };
  }

  private async rankOf(field: RankField, itemId?: string | null): Promise<string | null> {
    if (!itemId) return null;
    const item = await this.prisma.workItem.findUnique({
      where: { id: itemId },
      select: { rank: true, boardRank: true },
    });
    return item ? item[field] : null;
  }
}
