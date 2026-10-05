import { PrismaClient, Prisma } from '@prisma/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renumberSiblings } from '../src/modules/work-items/work-item-numbering';

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.workItem.findMany({
    where: { deletedAt: null },
    select: { id: true, projectId: true, parentId: true, type: true, number: true, rank: true },
  });
  const backupDir = resolve(__dirname, '../../../backups');
  mkdirSync(backupDir, { recursive: true });
  const backup = resolve(backupDir, `work-item-numbers-${Date.now()}.json`);
  writeFileSync(backup, JSON.stringify(items, null, 2));
  const scopes = new Map(
    items.map((item) => [JSON.stringify([item.projectId, item.type, item.parentId]), item]),
  );
  await prisma.$transaction(
    async (tx) => {
      for (const scope of scopes.values()) {
        await renumberSiblings(tx, scope.projectId, scope.type, scope.parentId);
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000 },
  );
  console.log(`Numérotation alignée sur le rank : ${scopes.size} groupes. Sauvegarde : ${backup}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
