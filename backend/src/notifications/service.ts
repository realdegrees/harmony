import { db } from '../db/client';
import type { Notification, UnreadState } from '@harmony/shared/types';
import { NotificationType } from '@harmony/shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNotification(row: {
  id: string;
  userId: string;
  type: string;
  referenceId: string;
  channelId: string | null;
  read: boolean;
  createdAt: Date;
}): Notification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as NotificationType,
    referenceId: row.referenceId,
    channelId: row.channelId,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function createNotification(
  userId: string,
  type: NotificationType,
  referenceId: string,
  channelId?: string,
): Promise<Notification> {
  const notification = await db.notification.create({
    data: {
      userId,
      type,
      referenceId,
      channelId: channelId ?? null,
    },
  });

  return toNotification(notification);
}

export async function getUnreadNotifications(userId: string): Promise<Notification[]> {
  const rows = await db.notification.findMany({
    where: { userId, read: false },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map(toNotification);
}

export async function getUnreadCounts(userId: string): Promise<UnreadState[]> {
  interface DbReadState {
    userId: string;
    channelId: string;
    lastReadMessageId: string | null;
    lastReadAt: Date | null;
  }

  // Get all channel read states for this user
  const readStates = (await db.channelReadState.findMany({
    where: { userId },
  })) as DbReadState[];

  // Get all channels the user has interacted with or that have notifications
  const notificationChannels = (await db.notification.findMany({
    where: { userId, read: false, channelId: { not: null } },
    distinct: ['channelId'],
    select: { channelId: true },
  })) as Array<{ channelId: string | null }>;

  const channelIds = new Set([
    ...readStates.map((rs: DbReadState) => rs.channelId),
    ...notificationChannels
      .map((n: { channelId: string | null }) => n.channelId)
      .filter((id): id is string => id !== null),
  ]);

  const results: UnreadState[] = await Promise.all(
    Array.from(channelIds).map(async (channelId) => {
      const readState = readStates.find((rs: DbReadState) => rs.channelId === channelId);

      const unreadCount = readState?.lastReadAt
        ? await db.message.count({
            where: {
              channelId,
              createdAt: { gt: readState.lastReadAt as Date },
            },
          })
        : await db.message.count({ where: { channelId } });

      const hasMention = await db.notification
        .count({
          where: {
            userId,
            channelId,
            read: false,
            type: NotificationType.MENTION,
          },
        })
        .then((c: number) => c > 0);

      return {
        channelId,
        unreadCount,
        lastReadMessageId: readState?.lastReadMessageId ?? null,
        hasMention,
      };
    }),
  );

  return results;
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  await db.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}

export async function markAllRead(userId: string, channelId?: string): Promise<void> {
  await db.notification.updateMany({
    where: {
      userId,
      read: false,
      ...(channelId ? { channelId } : {}),
    },
    data: { read: true },
  });
}

export async function acknowledgeChannel(
  userId: string,
  channelId: string,
  messageId: string,
): Promise<void> {
  // Get the message's timestamp to update the read state
  const message = await db.message.findUnique({
    where: { id: messageId },
    select: { createdAt: true },
  });

  const lastReadAt = message?.createdAt ?? new Date();

  await db.channelReadState.upsert({
    where: { userId_channelId: { userId, channelId } },
    create: { userId, channelId, lastReadMessageId: messageId, lastReadAt },
    update: { lastReadMessageId: messageId, lastReadAt },
  });

  // Also mark all notifications for this channel as read
  await markAllRead(userId, channelId);
}
