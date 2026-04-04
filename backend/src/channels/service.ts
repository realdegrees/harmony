import { db } from '../db/client';
import type { Channel, ChannelWithUnread } from '@harmony/shared/types';
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
  createdAt: Date;
}): Channel {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ChannelType,
    topic: row.topic,
    position: row.position,
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
