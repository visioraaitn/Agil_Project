import { z } from 'zod';
import { ProjectRole, ProjectStatus } from '../enums';
import { paginationSchema, uuidSchema } from './common';

/** Clé courte affichée dans les identifiants de tickets : VIS-142. */
export const projectKeySchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, 'La clé doit contenir au moins 2 caractères')
  .max(10, 'La clé ne peut pas dépasser 10 caractères')
  .regex(/^[A-Z][A-Z0-9]*$/, 'La clé doit commencer par une lettre (A-Z, 0-9 ensuite)');

const isoDate = z.coerce.date();

export const createProjectSchema = z.object({
  key: projectKeySchema,
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').max(160),
  description: z.string().max(2000).nullable().optional(),
  company: z.string().max(160).nullable().optional(),
  startDate: isoDate.nullable().optional(),
  targetDate: isoDate.nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'La couleur doit être au format #RRGGBB')
    .nullable()
    .optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema
  .omit({ key: true })
  .partial()
  .extend({ status: z.nativeEnum(ProjectStatus).optional() })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun champ à mettre à jour',
  })
  .refine(
    (value) => !value.startDate || !value.targetDate || value.startDate <= value.targetDate,
    { message: 'La date de fin doit être postérieure à la date de début', path: ['targetDate'] },
  );
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const listProjectsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(160).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  /** `true` = uniquement les projets dont l'utilisateur courant est membre. */
  mine: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export const addProjectMemberSchema = z.object({
  userId: uuidSchema,
  role: z.nativeEnum(ProjectRole),
  capacity: z.number().int().min(0).max(200).nullable().optional(),
});
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

export const updateProjectMemberSchema = z
  .object({
    role: z.nativeEnum(ProjectRole).optional(),
    capacity: z.number().int().min(0).max(200).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun champ à mettre à jour',
  });
export type UpdateProjectMemberInput = z.infer<typeof updateProjectMemberSchema>;

export interface ProjectMemberSummary {
  id: string;
  role: ProjectRole;
  capacity: number | null;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    isActive: boolean;
  };
}

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  company: string | null;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  color: string | null;
  memberCount: number;
  /** Rôle de l'utilisateur courant sur ce projet, `null` s'il n'est pas membre. */
  currentUserRole: ProjectRole | null;
  createdAt: string;
}
