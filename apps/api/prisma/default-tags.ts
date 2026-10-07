import type { PrismaClient } from '@prisma/client';

export const DEFAULT_TAGS = [
  { name: 'IA', color: '#8764B8' },
  { name: 'Frontend', color: '#0078D4' },
  { name: 'Backend', color: '#107C10' },
  { name: 'Mobile', color: '#CA5010' },
  { name: 'Web', color: '#038387' },
  { name: 'DevOps', color: '#605E5C' },
] as const;

/** Ajoute les tags manquants et synchronise leurs couleurs sans supprimer de données. */
export async function seedProjectTags(prisma: PrismaClient, projectId: string) {
  return prisma.$transaction(
    DEFAULT_TAGS.map(({ name, color }) =>
      prisma.tag.upsert({
        where: { projectId_name: { projectId, name } },
        create: { projectId, name, color },
        update: { color },
      }),
    ),
  );
}
