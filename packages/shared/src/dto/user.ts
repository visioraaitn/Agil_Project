import { z } from 'zod';
import { GlobalRole } from '../enums';
import { passwordSchema } from './auth';
import { paginationSchema } from './common';

export const createUserSchema = z.object({
  email: z.string().email("L'adresse email est invalide").toLowerCase(),
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères').max(120),
  password: passwordSchema,
  jobTitle: z.string().max(120).nullable().optional(),
  globalRole: z.nativeEnum(GlobalRole).default(GlobalRole.MEMBER),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    name: z.string().min(2).max(120).optional(),
    email: z.string().email().toLowerCase().optional(),
    jobTitle: z.string().max(120).nullable().optional(),
    avatarUrl: z.string().url().nullable().optional(),
    isActive: z.boolean().optional(),
    globalRole: z.nativeEnum(GlobalRole).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Aucun champ à mettre à jour',
  });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** Réinitialisation par un administrateur (l'utilisateur passe par changePassword). */
export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const listUsersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  globalRole: z.nativeEnum(GlobalRole).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const userDirectoryQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});
export type UserDirectoryQuery = z.infer<typeof userDirectoryQuerySchema>;

/**
 * Annuaire minimal, lisible par tout utilisateur authentifié : il alimente les
 * sélecteurs (affectation d'un membre, assignation d'un ticket). Il n'expose ni
 * rôle global, ni statut d'activation, ni date de dernière connexion — ces
 * informations restent réservées à `user:manage`.
 */
export interface UserDirectoryEntry {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  globalRole: GlobalRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
