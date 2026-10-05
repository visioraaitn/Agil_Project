import type { Prisma } from '@prisma/client';
import { renumberSiblings } from './work-item-numbering';

it('échange des numéros sans violer leur unicité, avec des valeurs temporaires transactionnelles', async () => {
  const rows = [{ id: 'third', number: 3 }, { id: 'first', number: 1 }, { id: 'second', number: 2 }];
  const tx = { workItem: {
    findMany: jest.fn().mockResolvedValue(rows),
    update: jest.fn(async ({ where, data }: { where: { id: string }; data: { number: number } }) => {
      if (rows.some(row => row.id !== where.id && row.number === data.number)) throw new Error('Unique constraint');
      rows.find(row => row.id === where.id)!.number = data.number;
    }),
  } };
  await renumberSiblings(tx as unknown as Prisma.TransactionClient, 'project', 'STORY', 'epic');
  expect(rows).toEqual([{ id: 'third', number: 1 }, { id: 'first', number: 2 }, { id: 'second', number: 3 }]);
  tx.workItem.update.mockClear();
  await renumberSiblings(tx as unknown as Prisma.TransactionClient, 'project', 'STORY', 'epic');
  expect(tx.workItem.update).not.toHaveBeenCalled();
});
