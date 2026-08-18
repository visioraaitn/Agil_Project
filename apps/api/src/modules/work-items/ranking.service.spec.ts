import { BadRequestException } from '@nestjs/common';
import { INITIAL_RANK } from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RankingService } from './ranking.service';

const PROJECT_ID = 'project-1';

interface FakeItem {
  id: string;
  rank: string;
  boardRank: string;
}

function fakePrisma(items: FakeItem[], last: FakeItem | null = null) {
  return {
    workItem: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(items.find((item) => item.id === where.id) ?? null),
      ),
      findFirst: jest.fn(() => Promise.resolve(last)),
    },
  } as unknown as PrismaService;
}

describe('RankingService', () => {
  it('insère strictement entre deux voisins', async () => {
    const items: FakeItem[] = [
      { id: 'a', rank: 'a', boardRank: 'a' },
      { id: 'b', rank: 'c', boardRank: 'c' },
    ];
    const service = new RankingService(fakePrisma(items));

    const rank = await service.computeRank(
      'rank',
      { beforeId: 'a', afterId: 'b' },
      { projectId: PROJECT_ID },
    );

    expect(rank > 'a').toBe(true);
    expect(rank < 'c').toBe(true);
  });

  it('place en tête quand seul le voisin du dessous est fourni', async () => {
    const service = new RankingService(fakePrisma([{ id: 'b', rank: 'm', boardRank: 'm' }]));
    const rank = await service.computeRank('rank', { afterId: 'b' }, { projectId: PROJECT_ID });
    expect(rank < 'm').toBe(true);
  });

  it('place en queue quand seul le voisin du dessus est fourni', async () => {
    const service = new RankingService(fakePrisma([{ id: 'a', rank: 'm', boardRank: 'm' }]));
    const rank = await service.computeRank('rank', { beforeId: 'a' }, { projectId: PROJECT_ID });
    expect(rank > 'm').toBe(true);
  });

  it('sans voisin, se place après le dernier élément de la portée', async () => {
    const last: FakeItem = { id: 'z', rank: 'p', boardRank: 'p' };
    const service = new RankingService(fakePrisma([], last));
    const rank = await service.computeRank('rank', {}, { projectId: PROJECT_ID });
    expect(rank > 'p').toBe(true);
  });

  it('retourne le rang initial dans une liste vide', async () => {
    const service = new RankingService(fakePrisma([], null));
    const rank = await service.computeRank('rank', {}, { projectId: PROJECT_ID });
    expect(rank).toBe(INITIAL_RANK);
  });

  it('refuse des voisins inversés plutôt que de produire un ordre incohérent', async () => {
    const items: FakeItem[] = [
      { id: 'a', rank: 'z', boardRank: 'z' },
      { id: 'b', rank: 'b', boardRank: 'b' },
    ];
    const service = new RankingService(fakePrisma(items));

    await expect(
      service.computeRank('rank', { beforeId: 'a', afterId: 'b' }, { projectId: PROJECT_ID }),
    ).rejects.toThrow(BadRequestException);
  });

  it('lit le champ board quand on ordonne une colonne', async () => {
    // Rangs volontairement différents : seul `boardRank` doit être consulté.
    const items: FakeItem[] = [
      { id: 'a', rank: '0', boardRank: 'a' },
      { id: 'b', rank: '1', boardRank: 'c' },
    ];
    const service = new RankingService(fakePrisma(items));

    const rank = await service.computeRank(
      'boardRank',
      { beforeId: 'a', afterId: 'b' },
      { projectId: PROJECT_ID, status: 'IN_PROGRESS' },
    );

    expect(rank > 'a').toBe(true);
    expect(rank < 'c').toBe(true);
  });

  it('supporte des insertions répétées au même endroit', async () => {
    let low = 'a';
    const high = 'b';

    for (let i = 0; i < 100; i += 1) {
      const service = new RankingService(
        fakePrisma([
          { id: 'a', rank: low, boardRank: low },
          { id: 'b', rank: high, boardRank: high },
        ]),
      );
      const rank = await service.computeRank(
        'rank',
        { beforeId: 'a', afterId: 'b' },
        { projectId: PROJECT_ID },
      );
      expect(rank > low).toBe(true);
      expect(rank < high).toBe(true);
      low = rank;
    }
  });
});
