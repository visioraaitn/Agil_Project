import type { Prisma, WorkItemType } from '@prisma/client';

/** Numéros d'affichage consécutifs par type et parent, dans l'ordre du backlog. */
export async function renumberSiblings(
  tx: Prisma.TransactionClient,
  projectId: string,
  type: WorkItemType,
  parentId: string | null,
): Promise<void> {
  const siblings = await tx.workItem.findMany({
    where: { projectId, type, parentId, deletedAt: null },
    orderBy: [{ rank: 'asc' }, { id: 'asc' }],
    select: { id: true, number: true },
  });
  const changed = siblings
    .map((item, index) => ({ ...item, nextNumber: index + 1 }))
    .filter((item) => item.number !== item.nextNumber);

  // Les index uniques sont immédiats : libérer les anciens numéros avant un
  // échange (2 ↔ 3). Ces valeurs temporaires restent dans la transaction.
  for (const item of changed) {
    await tx.workItem.update({ where: { id: item.id }, data: { number: -item.nextNumber } });
  }
  for (const item of changed) {
    await tx.workItem.update({ where: { id: item.id }, data: { number: item.nextNumber } });
  }
}
