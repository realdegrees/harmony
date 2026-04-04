import { z } from 'zod';
import { Limits } from '../constants/limits.ts';

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(Limits.MAX_MESSAGE_LENGTH),
  replyToId: z.string().uuid().optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(Limits.MAX_MESSAGE_LENGTH),
});

export const searchMessagesSchema = z.object({
  query: z.string().min(1).max(200),
  authorId: z.string().uuid().optional(),
  channelId: z.string().uuid().optional(),
  hasAttachment: z.boolean().optional(),
  hasLink: z.boolean().optional(),
  hasImage: z.boolean().optional(),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const reactionSchema = z
  .object({
    messageId: z.string().uuid(),
    emojiId: z.string().uuid().optional(),
    emojiUnicode: z.string().max(32).optional(),
  })
  .refine((data) => data.emojiId !== undefined || data.emojiUnicode !== undefined, {
    message: 'Either emojiId or emojiUnicode is required',
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type SearchMessagesInput = z.infer<typeof searchMessagesSchema>;
export type ReactionInput = z.infer<typeof reactionSchema>;
