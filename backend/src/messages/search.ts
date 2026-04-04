import { db } from '../db/client';
import type { SearchFilters, PaginatedMessages } from '@harmony/shared/types';
import { toMessage, MESSAGE_INCLUDE, type RawMessage } from './_helpers';

// ---------------------------------------------------------------------------
// NOTE: Full-text search migration SQL (add as a Prisma migration):
//
//   ALTER TABLE messages
//     ADD COLUMN IF NOT EXISTS search_vector tsvector
//     GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
//
//   CREATE INDEX IF NOT EXISTS idx_messages_search_vector
//     ON messages USING gin(search_vector);
//
// Until that migration runs this module falls back to ILIKE.
// ---------------------------------------------------------------------------

const HAS_TSVECTOR_QUERY = `
  SELECT 1
  FROM information_schema.columns
  WHERE table_name = 'messages'
    AND column_name = 'search_vector'
  LIMIT 1
`;

let tsvectorAvailable: boolean | null = null;

async function checkTsvector(): Promise<boolean> {
  if (tsvectorAvailable !== null) return tsvectorAvailable;
  try {
    const result = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(HAS_TSVECTOR_QUERY);
    tsvectorAvailable = result.length > 0;
  } catch {
    tsvectorAvailable = false;
  }
  return tsvectorAvailable;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export async function searchMessages(
  filters: SearchFilters & { cursor?: string; limit?: number },
): Promise<PaginatedMessages> {
  const limit = Math.min(filters.limit ?? 50, 100);
  const useFts = await checkTsvector();

  // Build Prisma where conditions
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

  if (filters.hasLink && !useFts) {
    // Will be combined below with the query filter when using ILIKE
    where.content = { contains: 'http' };
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

  let rows: RawMessage[];

  if (useFts && filters.query) {
    // Use raw SQL for full-text search to get matching IDs, then load relations
    const ftsResult = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM messages
       WHERE search_vector @@ plainto_tsquery('english', $1)
       ORDER BY created_at DESC
       LIMIT $2`,
      filters.query,
      limit + 1,
    );

    const ids = (ftsResult as Array<{ id: string }>).map((r) => r.id);
    if (ids.length === 0) {
      return { messages: [], hasMore: false, cursor: null };
    }

    rows = (await db.message.findMany({
      where: { id: { in: ids }, ...where } as any,
      orderBy: { createdAt: 'desc' },
      include: MESSAGE_INCLUDE,
    })) as unknown as RawMessage[];
  } else {
    // Fallback: ILIKE search
    if (filters.query) {
      where.content = {
        ...(typeof where.content === 'object' && where.content !== null
          ? (where.content as object)
          : {}),
        contains: filters.query,
        mode: 'insensitive',
      };
    }

    rows = (await db.message.findMany({
      where: where as any,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: MESSAGE_INCLUDE,
    })) as unknown as RawMessage[];
  }

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
