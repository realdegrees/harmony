import { z } from 'zod';
import { Limits } from '../constants/limits.ts';

export const registerSchema = z.object({
  username: z
    .string()
    .min(Limits.MIN_USERNAME_LENGTH)
    .max(Limits.MAX_USERNAME_LENGTH)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores and hyphens',
    ),
  displayName: z.string().min(1).max(Limits.MAX_DISPLAY_NAME_LENGTH),
  password: z.string().min(Limits.MIN_PASSWORD_LENGTH).max(Limits.MAX_PASSWORD_LENGTH),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(Limits.MAX_DISPLAY_NAME_LENGTH).optional(),
  status: z.enum(['ONLINE', 'OFFLINE', 'APPEAR_OFFLINE', 'BUSY']).optional(),
});

export const createRoleSchema = z.object({
  name: z.string().min(1).max(Limits.MAX_ROLE_NAME_LENGTH),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid hex color (e.g. #ff0000)')
    .optional(),
  /** Serialized bigint string. */
  permissions: z.string().optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(Limits.MAX_ROLE_NAME_LENGTH).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid hex color (e.g. #ff0000)')
    .nullable()
    .optional(),
  /** Serialized bigint string. */
  permissions: z.string().optional(),
  position: z.number().int().min(0).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
