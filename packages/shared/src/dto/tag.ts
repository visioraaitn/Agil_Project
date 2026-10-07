import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'La couleur doit être au format #RRGGBB');

export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(40),
  color: hexColor.default('#0078D4'),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;

export const updateTagSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    color: hexColor.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ à mettre à jour' });
export type UpdateTagInput = z.infer<typeof updateTagSchema>;

export interface TagSummary {
  id: string;
  name: string;
  color: string;
}

/** Palette de couleurs pour les tags. */
export const TAG_COLORS = [
  '#8764B8', // IA / Violet
  '#0078D4', // Frontend / Bleu Azure
  '#107C10', // Backend / Vert
  '#CA5010', // Mobile / Orange
  '#038387', // Web / Turquoise
  '#605E5C', // DevOps / Gris
  '#D13438', // Rouge
  '#4F6BED', // Indigo
] as const;
