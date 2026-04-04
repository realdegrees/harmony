import { z } from 'zod';
import { Limits } from '../constants/limits.ts';

export const createChannelSchema = z.object({
  name: z.string().min(1).max(Limits.MAX_CHANNEL_NAME_LENGTH),
  type: z.enum(['TEXT', 'VOICE']),
  topic: z.string().max(Limits.MAX_CHANNEL_TOPIC_LENGTH).optional(),
  categoryId: z.string().uuid().optional(),
});

export const updateChannelSchema = z.object({
  name: z.string().min(1).max(Limits.MAX_CHANNEL_NAME_LENGTH).optional(),
  topic: z.string().max(Limits.MAX_CHANNEL_TOPIC_LENGTH).nullable().optional(),
  position: z.number().int().min(0).optional(),
});

export const channelPermissionOverrideSchema = z.object({
  targetType: z.enum(['ROLE', 'USER']),
  targetId: z.string().uuid(),
  /** Serialized bigint string. */
  allow: z.string(),
  /** Serialized bigint string. */
  deny: z.string(),
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(Limits.MAX_CHANNEL_NAME_LENGTH),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(Limits.MAX_CHANNEL_NAME_LENGTH).optional(),
  position: z.number().int().min(0).optional(),
});

export const moveChannelToCategorySchema = z.object({
  categoryId: z.string().uuid().nullable(),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type ChannelPermissionOverrideInput = z.infer<typeof channelPermissionOverrideSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type MoveChannelToCategoryInput = z.infer<typeof moveChannelToCategorySchema>;
