import { db } from '../db/client';
import type { MessageReaction } from '@harmony/shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEmojiKey(
  emojiId?: string | null,
  emojiUnicode?: string | null,
): string {
  return emojiId ?? emojiUnicode ?? '';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function addReaction(
  messageId: string,
  userId: string,
  emojiId?: string,
  emojiUnicode?: string,
): Promise<MessageReaction> {
  if (!emojiId && !emojiUnicode) {
    throw Object.assign(new Error('Either emojiId or emojiUnicode is required'), {
      statusCode: 400,
    });
  }

  const message = await db.message.findUnique({
    where: { id: messageId },
    select: { id: true },
  });
  if (!message) {
    throw Object.assign(new Error('Message not found'), { statusCode: 404 });
  }

  // Upsert — prevents double-react
  await db.reaction.upsert({
    where: {
      messageId_userId_emojiId_emojiUnicode: {
        messageId,
        userId,
        emojiId: emojiId ?? null,
        emojiUnicode: emojiUnicode ?? null,
      },
    },
    create: {
      messageId,
      userId,
      emojiId: emojiId ?? null,
      emojiUnicode: emojiUnicode ?? null,
    },
    update: {},
  });

  // Return the aggregated entry for this emoji
  const reactions = await getMessageReactions(messageId, userId);
  const key = buildEmojiKey(emojiId, emojiUnicode);
  const found = reactions.find(
    (r) => buildEmojiKey(r.emojiId, r.emojiUnicode) === key,
  );

  return (
    found ?? {
      emojiId: emojiId ?? null,
      emojiUnicode: emojiUnicode ?? null,
      emoji: emojiUnicode ?? emojiId ?? '',
      count: 1,
      reacted: true,
    }
  );
}

export async function removeReaction(
  messageId: string,
  userId: string,
  emojiId?: string,
  emojiUnicode?: string,
): Promise<void> {
  await db.reaction.deleteMany({
    where: {
      messageId,
      userId,
      emojiId: emojiId ?? null,
      emojiUnicode: emojiUnicode ?? null,
    },
  });
}

export async function getMessageReactions(
  messageId: string,
  currentUserId?: string,
): Promise<MessageReaction[]> {
  const rows = await db.reaction.findMany({
    where: { messageId },
    include: {
      emoji: { select: { name: true } },
    },
  });

  // Aggregate by emoji key
  const map = new Map<
    string,
    {
      emojiId: string | null;
      emojiUnicode: string | null;
      emojiDisplay: string;
      userIds: string[];
    }
  >();

  for (const r of rows) {
    const key = buildEmojiKey(r.emojiId, r.emojiUnicode);
    if (!map.has(key)) {
      const emojiDisplay =
        (r as unknown as { emoji: { name: string } | null }).emoji?.name ??
        r.emojiUnicode ??
        key;
      map.set(key, {
        emojiId: r.emojiId,
        emojiUnicode: r.emojiUnicode,
        emojiDisplay,
        userIds: [],
      });
    }
    map.get(key)!.userIds.push(r.userId);
  }

  return Array.from(map.values()).map((entry) => ({
    emojiId: entry.emojiId,
    emojiUnicode: entry.emojiUnicode,
    emoji: entry.emojiDisplay,
    count: entry.userIds.length,
    reacted: currentUserId ? entry.userIds.includes(currentUserId) : false,
  }));
}
