import type { PrismaClient } from '@prisma/client';

export const DEFAULT_LABELS = [
  { name: 'À valider', color: '#D13438' },
  { name: 'Devis', color: '#CA5010' },
  { name: 'Lot 1', color: '#0078D4' },
  { name: 'Lot 2', color: '#107C10' },
  { name: 'Lot 3', color: '#8764B8' },
  { name: 'Mixte', color: '#038387' },
] as const;

/** Ajoute les étiquettes manquantes et synchronise leurs couleurs sans supprimer de données. */
export async function seedProjectLabels(prisma: PrismaClient, projectId: string) {
  return prisma.$transaction(
    DEFAULT_LABELS.map(({ name, color }) =>
      prisma.label.upsert({
        where: { projectId_name: { projectId, name } },
        create: { projectId, name, color },
        update: { color },
      }),
    ),
  );
}
