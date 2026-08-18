import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'La couleur doit être au format #RRGGBB');

export const createLabelSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(40),
  color: hexColor.default('#0078D4'),
});
export type CreateLabelInput = z.infer<typeof createLabelSchema>;

export const updateLabelSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    color: hexColor.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Aucun champ à mettre à jour' });
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;

/** Palette proposée dans l'UI — cohérente avec le thème. */
export const LABEL_COLORS = [
  '#0078D4',
  '#107C10',
  '#CA5010',
  '#D13438',
  '#8764B8',
  '#038387',
  '#605E5C',
] as const;
