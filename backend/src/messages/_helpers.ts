import type { Message, MessageReaction } from '@harmony/shared/types';

// ---------------------------------------------------------------------------
// Internal raw DB shape (post-include)
// ---------------------------------------------------------------------------

export type RawReaction = {
  id: string;
  messageId: string;
  userId: string;
  emojiId: string | null;
  emojiUnicode: string | null;
  emoji: { name: string } | null;
};

export type RawAuthor = {
  id: string;
  username: string;
  displayName: string;
  avatarPath: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type RawAttachment = {
  id: string;
  messageId: string;
  filename: string;
  path: string;
  mimeType: string;
  size: number;
};

export type RawMessage = {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  replyToId: string | null;
  editedAt: Date | null;
  createdAt: Date;
  author: RawAuthor;
  attachments: RawAttachment[];
  reactions: RawReaction[];
  replyTo: {
    id: string;
    content: string;
    authorId: string;
    author: RawAuthor;
  } | null;
};

// ---------------------------------------------------------------------------
// Aggregation helper
// ---------------------------------------------------------------------------

export function aggregateReactions(
  reactions: RawReaction[],
  currentUserId?: string,
): MessageReaction[] {
  const map = new Map<
    string,
    {
      emojiId: string | null;
      emojiUnicode: string | null;
      emoji: string;
      userIds: string[];
    }
  >();

  for (const r of reactions) {
    const key = r.emojiId ?? r.emojiUnicode ?? '';
    if (!map.has(key)) {
      map.set(key, {
        emojiId: r.emojiId,
        emojiUnicode: r.emojiUnicode,
        emoji: r.emoji?.name ?? r.emojiUnicode ?? key,
        userIds: [],
      });
    }
    map.get(key)!.userIds.push(r.userId);
  }

  return Array.from(map.values()).map((entry) => ({
    emojiId: entry.emojiId,
    emojiUnicode: entry.emojiUnicode,
    emoji: entry.emoji,
    count: entry.userIds.length,
    reacted: currentUserId ? entry.userIds.includes(currentUserId) : false,
  }));
}

// ---------------------------------------------------------------------------
// toMessage
// ---------------------------------------------------------------------------

export function mapAuthor(raw: RawAuthor) {
  return {
    id: raw.id,
    username: raw.username,
    displayName: raw.displayName,
    avatarPath: raw.avatarPath,
    status: raw.status as any,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}

export function toMessage(raw: RawMessage, currentUserId?: string): Message {
  const author = mapAuthor(raw.author);

  const attachments = raw.attachments.map((a) => ({
    id: a.id,
    messageId: a.messageId,
    filename: a.filename,
    path: a.path,
    mimeType: a.mimeType,
    size: a.size,
    url: `/uploads/${a.path}`,
  }));

  const reactions = aggregateReactions(raw.reactions, currentUserId);

  let replyTo: Message['replyTo'] = null;
  if (raw.replyTo) {
    replyTo = {
      id: raw.replyTo.id,
      content: raw.replyTo.content,
      authorId: raw.replyTo.authorId,
      author: mapAuthor(raw.replyTo.author),
    };
  }

  return {
    id: raw.id,
    channelId: raw.channelId,
    authorId: raw.authorId,
    content: raw.content,
    replyToId: raw.replyToId,
    editedAt: raw.editedAt?.toISOString() ?? null,
    createdAt: raw.createdAt.toISOString(),
    author,
    attachments,
    reactions,
    replyTo,
  };
}

// ---------------------------------------------------------------------------
// Shared Prisma include spec
// ---------------------------------------------------------------------------

export const MESSAGE_INCLUDE = {
  author: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarPath: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  attachments: true,
  reactions: {
    include: {
      emoji: { select: { name: true } },
    },
  },
  replyTo: {
    select: {
      id: true,
      content: true,
      authorId: true,
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarPath: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
} as const;
