import { db } from '../db/client';
import type { Channel, DirectMessageChannel } from '@harmony/shared/types';
import { ChannelType } from '@harmony/shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeUserIds(
  user1Id: string,
  user2Id: string,
): [string, string] {
  // Always store lower UUID string as user1 for deduplication consistency
  return user1Id < user2Id ? [user1Id, user2Id] : [user2Id, user1Id];
}

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

export async function getOrCreateDM(
  userAId: string,
  userBId: string,
): Promise<{ channel: Channel; isNew: boolean }> {
  const [user1Id, user2Id] = normalizeUserIds(userAId, userBId);

  // Check if DM already exists
  const existing = await db.directMessage.findUnique({
    where: { user1Id_user2Id: { user1Id, user2Id } },
    include: { channel: true },
  });

  if (existing) {
    return { channel: toChannel(existing.channel), isNew: false };
  }

  // Create a new DM channel
  const channel = await db.channel.create({
    data: {
      name: `dm-${user1Id}-${user2Id}`,
      type: 'DM',
      position: 0,
      dm: {
        create: { user1Id, user2Id },
      },
    },
  });

  return { channel: toChannel(channel), isNew: true };
}

export async function getUserDMs(userId: string): Promise<DirectMessageChannel[]> {
  const dms = await db.directMessage.findMany({
    where: {
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
    include: {
      channel: true,
      user1: {
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
      user2: {
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
    orderBy: {
      channel: { updatedAt: 'desc' },
    },
  });

  type DmWithRelations = typeof dms[number];
  return dms.map((dm: DmWithRelations) => ({
    id: dm.id,
    channelId: dm.channelId,
    user1Id: dm.user1Id,
    user2Id: dm.user2Id,
    channel: toChannel(dm.channel),
    // Include both users for client convenience
    user1: {
      id: dm.user1.id,
      username: dm.user1.username,
      displayName: dm.user1.displayName,
      avatarPath: dm.user1.avatarPath,
      status: dm.user1.status as any,
      createdAt: dm.user1.createdAt.toISOString(),
      updatedAt: dm.user1.updatedAt.toISOString(),
    },
    user2: {
      id: dm.user2.id,
      username: dm.user2.username,
      displayName: dm.user2.displayName,
      avatarPath: dm.user2.avatarPath,
      status: dm.user2.status as any,
      createdAt: dm.user2.createdAt.toISOString(),
      updatedAt: dm.user2.updatedAt.toISOString(),
    },
  }));
}

export async function getDMByChannelId(
  channelId: string,
): Promise<DirectMessageChannel | null> {
  const dm = await db.directMessage.findUnique({
    where: { channelId },
    include: { channel: true },
  });

  if (!dm) return null;

  return {
    id: dm.id,
    channelId: dm.channelId,
    user1Id: dm.user1Id,
    user2Id: dm.user2Id,
    channel: toChannel(dm.channel),
  };
}
