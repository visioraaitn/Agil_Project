import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationQuery = z.infer<typeof paginationSchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']).default('asc');

/** Corps commun à tous les déplacements par glisser-déposer (backlog et board). */
export const reorderSchema = z
  .object({
    /** Identifiant du voisin de gauche/haut après déplacement. */
    beforeId: uuidSchema.nullable().optional(),
    /** Identifiant du voisin de droite/bas après déplacement. */
    afterId: uuidSchema.nullable().optional(),
  })
  .refine((value) => value.beforeId != null || value.afterId != null, {
    message: 'Au moins un voisin (beforeId ou afterId) doit être fourni',
  });
export type ReorderInput = z.infer<typeof reorderSchema>;
