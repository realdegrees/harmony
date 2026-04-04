import { db } from '../db/client';
import { env } from '../config/env';
import type { Message, PaginatedMessages } from '@harmony/shared/types';
import { toMessage, MESSAGE_INCLUDE, type RawMessage } from './_helpers';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function sendMessage(
  channelId: string,
  authorId: string,
  content: string,
  replyToId?: string,
  attachmentIds?: string[],
): Promise<Message> {
  const raw = await db.message.create({
    data: {
      channelId,
      authorId,
      content,
      replyToId: replyToId ?? null,
      ...(attachmentIds?.length
        ? {
            attachments: {
              connect: attachmentIds.map((id) => ({ id })),
            },
          }
        : {}),
    },
    include: MESSAGE_INCLUDE,
  });

  return toMessage(raw as unknown as RawMessage, authorId);
}

export async function editMessage(
  messageId: string,
  userId: string,
  content: string,
): Promise<Message> {
  const existing = await db.message.findUnique({
    where: { id: messageId },
    select: { authorId: true },
  });

  if (!existing) {
    throw Object.assign(new Error('Message not found'), { statusCode: 404 });
  }
  if (existing.authorId !== userId) {
    throw Object.assign(new Error("Cannot edit another user's message"), { statusCode: 403 });
  }

  const raw = await db.message.update({
    where: { id: messageId },
    data: { content, editedAt: new Date() },
    include: MESSAGE_INCLUDE,
  });

  return toMessage(raw as unknown as RawMessage, userId);
}

export async function deleteMessage(
  messageId: string,
  userId: string,
  hasDeleteAnyPermission: boolean,
): Promise<void> {
  const existing = await db.message.findUnique({
    where: { id: messageId },
    select: { authorId: true },
  });

  if (!existing) {
    throw Object.assign(new Error('Message not found'), { statusCode: 404 });
  }

  const isAuthor = existing.authorId === userId;
  if (!isAuthor && !hasDeleteAnyPermission) {
    throw Object.assign(new Error("Cannot delete another user's message"), { statusCode: 403 });
  }

  await db.message.delete({ where: { id: messageId } });
}

export async function getMessages(
  channelId: string,
  options: { cursor?: string; limit?: number },
): Promise<PaginatedMessages> {
  const limit = Math.min(options.limit ?? env.DEFAULT_MESSAGE_LOAD_COUNT, 100);

  let cursorDate: Date | undefined;
  if (options.cursor) {
    const cursorMsg = await db.message.findUnique({
      where: { id: options.cursor },
      select: { createdAt: true },
    });
    cursorDate = cursorMsg?.createdAt;
  }

  const rows = await db.message.findMany({
    where: {
      channelId,
      ...(cursorDate ? { createdAt: { lt: cursorDate } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: MESSAGE_INCLUDE,
  });

  const hasMore = rows.length > limit;
  const messages = (rows as unknown[])
    .slice(0, limit)
    .map((r) => toMessage(r as unknown as RawMessage))
    .reverse();

  return {
    messages,
    hasMore,
    cursor: hasMore && messages.length > 0 ? messages[0].id : null,
  };
}

export async function getMessage(id: string): Promise<Message | null> {
  const raw = await db.message.findUnique({
    where: { id },
    include: MESSAGE_INCLUDE,
  });
  return raw ? toMessage(raw as unknown as RawMessage) : null;
}
