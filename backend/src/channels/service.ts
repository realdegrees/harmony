import { db } from '../db/client';
import type { Channel, ChannelWithUnread, ChannelCategory, ChannelCategoryWithChannels } from '@harmony/shared/types';
import { ChannelType } from '@harmony/shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toChannel(row: {
  id: string;
  name: string;
  type: string;
  topic: string | null;
  position: number;
  categoryId: string | null;
  createdAt: Date;
}): Channel {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ChannelType,
    topic: row.topic,
    position: row.position,
    categoryId: row.categoryId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCategory(row: {
  id: string;
  name: string;
  position: number;
  collapsed: boolean;
  createdAt: Date;
}): ChannelCategory {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    collapsed: row.collapsed,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function createChannel(data: {
  name: string;
  type: ChannelType;
  topic?: string;
  categoryId?: string;
}): Promise<Channel> {
  // Determine next position
  const last = await db.channel.findFirst({
    where: { type: { in: ['TEXT', 'VOICE'] } },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = last ? last.position + 1 : 0;

  const channel = await db.channel.create({
    data: {
      name: data.name,
      type: data.type as any,
      topic: data.topic ?? null,
      position,
      categoryId: data.categoryId ?? null,
    },
  });

  return toChannel(channel);
}

export async function updateChannel(
  id: string,
  data: { name?: string; topic?: string | null; position?: number },
): Promise<Channel> {
  const channel = await db.channel.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.topic !== undefined && { topic: data.topic }),
      ...(data.position !== undefined && { position: data.position }),
    },
  });

  return toChannel(channel);
}

export async function deleteChannel(id: string): Promise<void> {
  await db.channel.delete({ where: { id } });
}

export async function getChannel(id: string): Promise<Channel | null> {
  const channel = await db.channel.findUnique({ where: { id } });
  return channel ? toChannel(channel) : null;
}

export async function getAllChannels(): Promise<Channel[]> {
  const channels = await db.channel.findMany({
    where: { type: { in: ['TEXT', 'VOICE'] } },
    orderBy: { position: 'asc' },
  });
  return channels.map(toChannel);
}

export async function getChannelsForUser(userId: string): Promise<ChannelWithUnread[]> {
  const channels = await db.channel.findMany({
    where: { type: { in: ['TEXT', 'VOICE'] } },
    orderBy: { position: 'asc' },
    include: {
      readStates: {
        where: { userId },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true, id: true },
      },
    },
  });

  type ChannelWithRelations = typeof channels[number];
  const results: ChannelWithUnread[] = await Promise.all(
    channels.map(async (ch: ChannelWithRelations) => {
      const readState = ch.readStates[0] ?? null;
      const lastMessageAt = ch.messages[0]?.createdAt?.toISOString() ?? null;

      let unreadCount = 0;
      if (readState?.lastReadAt) {
        unreadCount = await db.message.count({
          where: {
            channelId: ch.id,
            createdAt: { gt: readState.lastReadAt },
          },
        });
      } else {
        // Never read — count all messages
        unreadCount = await db.message.count({ where: { channelId: ch.id } });
      }

      return {
        ...toChannel(ch),
        unreadCount,
        lastMessageAt,
      };
    }),
  );

  return results;
}

export async function reorderChannels(channelIds: string[]): Promise<void> {
  await db.$transaction(
    channelIds.map((id, index) =>
      db.channel.update({
        where: { id },
        data: { position: index },
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Category service
// ---------------------------------------------------------------------------

export async function createCategory(name: string): Promise<ChannelCategory> {
  const last = await db.channelCategory.findFirst({
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = last ? last.position + 1 : 0;

  const category = await db.channelCategory.create({
    data: { name, position },
  });
  return toCategory(category);
}

export async function updateCategory(
  id: string,
  data: { name?: string; position?: number },
): Promise<ChannelCategory> {
  const category = await db.channelCategory.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.position !== undefined && { position: data.position }),
    },
  });
  return toCategory(category);
}

export async function deleteCategory(id: string): Promise<void> {
  // Channels in the deleted category will have categoryId set to null via onDelete: SetNull
  await db.channelCategory.delete({ where: { id } });
}

export async function getAllCategories(): Promise<ChannelCategory[]> {
  const categories = await db.channelCategory.findMany({
    orderBy: { position: 'asc' },
  });
  return categories.map(toCategory);
}

export async function getCategoriesWithChannels(
  userId: string,
): Promise<ChannelCategoryWithChannels[]> {
  const categories = await db.channelCategory.findMany({
    orderBy: { position: 'asc' },
    include: {
      channels: {
        where: { type: { in: ['TEXT', 'VOICE'] } },
        orderBy: { position: 'asc' },
        include: {
          readStates: { where: { userId } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true, id: true },
          },
        },
      },
    },
  });

  return Promise.all(
    categories.map(async (cat) => {
      const channelsWithUnread: ChannelWithUnread[] = await Promise.all(
        cat.channels.map(async (ch) => {
          const readState = ch.readStates[0] ?? null;
          const lastMessageAt = ch.messages[0]?.createdAt?.toISOString() ?? null;

          let unreadCount = 0;
          if (readState?.lastReadAt) {
            unreadCount = await db.message.count({
              where: { channelId: ch.id, createdAt: { gt: readState.lastReadAt } },
            });
          } else {
            unreadCount = await db.message.count({ where: { channelId: ch.id } });
          }

          return { ...toChannel(ch), unreadCount, lastMessageAt };
        }),
      );

      return {
        ...toCategory(cat),
        channels: channelsWithUnread,
      };
    }),
  );
}

export async function moveChannelToCategory(
  channelId: string,
  categoryId: string | null,
): Promise<void> {
  await db.channel.update({
    where: { id: channelId },
    data: { categoryId },
  });
}
