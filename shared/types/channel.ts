export enum ChannelType {
  TEXT = 'TEXT',
  VOICE = 'VOICE',
  DM = 'DM',
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  topic: string | null;
  position: number;
  createdAt: string;
}

export interface ChannelWithUnread extends Channel {
  unreadCount: number;
  lastMessageAt: string | null;
}

export interface DirectMessageChannel {
  id: string;
  channelId: string;
  user1Id: string;
  user2Id: string;
  channel: Channel;
}
