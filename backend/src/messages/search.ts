import { db } from '../db/client';
import type { SearchFilters, PaginatedMessages } from '@harmony/shared/types';
import { toMessage, MESSAGE_INCLUDE, type RawMessage } from './_helpers';

export async function searchMessages(
  filters: SearchFilters & { cursor?: string; limit?: number },
): Promise<PaginatedMessages> {
  const limit = Math.min(filters.limit ?? 50, 100);

  const where: Record<string, unknown> = {};

  if (filters.channelId) where.channelId = filters.channelId;
  if (filters.authorId) where.authorId = filters.authorId;

  const dateFilter: Record<string, Date> = {};
  if (filters.before) dateFilter.lt = new Date(filters.before);
  if (filters.after) dateFilter.gt = new Date(filters.after);
  if (Object.keys(dateFilter).length > 0) where.createdAt = dateFilter;

  if (filters.hasImage) {
    where.attachments = { some: { mimeType: { startsWith: 'image/' } } };
  } else if (filters.hasAttachment) {
    where.attachments = { some: {} };
  }

  if (filters.hasLink) {
    where.content = { contains: 'http' };
  }

  if (filters.query) {
    where.content = {
      ...(typeof where.content === 'object' && where.content !== null
        ? (where.content as object)
        : {}),
      contains: filters.query,
    };
  }

  // Cursor pagination
  if (filters.cursor) {
    const cursorMsg = await db.message.findUnique({
      where: { id: filters.cursor },
      select: { createdAt: true },
    });
    if (cursorMsg) {
      where.createdAt = {
        ...(typeof where.createdAt === 'object' && where.createdAt !== null
          ? (where.createdAt as object)
          : {}),
        lt: cursorMsg.createdAt,
      };
    }
  }

  const rows = (await db.message.findMany({
    where: where as any,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: MESSAGE_INCLUDE,
  })) as unknown as RawMessage[];

  const hasMore = rows.length > limit;
  const messages = rows
    .slice(0, limit)
    .map((r) => toMessage(r))
    .reverse();

  return {
    messages,
    hasMore,
    cursor: hasMore && messages.length > 0 ? messages[0].id : null,
  };
}
