export enum NotificationType {
  MENTION = 'MENTION',
  DM = 'DM',
  CHANNEL_MESSAGE = 'CHANNEL_MESSAGE',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  referenceId: string;
  channelId: string | null;
  read: boolean;
  createdAt: string;
}

export interface UnreadState {
  channelId: string;
  unreadCount: number;
  lastReadMessageId: string | null;
  hasMention: boolean;
}
