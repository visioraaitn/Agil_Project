import { z } from 'zod';
import { UserFunction } from '../enums';

const optionalUserFunctionSchema = z
  .union([z.nativeEnum(UserFunction), z.literal('')])
  .nullable()
  .optional();

export const passwordSchema = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caractères')
  .max(128)
  .regex(/[a-z]/, 'Au moins une minuscule est requise')
  .regex(/[A-Z]/, 'Au moins une majuscule est requise')
  .regex(/[0-9]/, 'Au moins un chiffre est requis');

export const loginSchema = z.object({
  email: z.string().email("L'adresse email est invalide"),
  password: z.string().min(1, 'Le mot de passe est requis'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  jobTitle: optionalUserFunctionSchema,
  avatarUrl: z.string().url().nullable().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
