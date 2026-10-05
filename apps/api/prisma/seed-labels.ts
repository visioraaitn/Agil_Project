import { PrismaClient } from '@prisma/client';
import { seedProjectLabels } from './default-labels';

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true } });
  for (const project of projects) await seedProjectLabels(prisma, project.id);
  console.log(`Labels synchronisés pour ${projects.length} projet(s).`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
