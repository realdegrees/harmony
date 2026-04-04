import { api } from '$lib/api/client';
import { ws } from '$lib/api/ws';
import type { ChannelWithUnread, DirectMessageChannel } from '@harmony/shared/types/channel';
import { ChannelType } from '@harmony/shared/types/channel';
import type { CreateChannelRequest, UpdateChannelRequest } from '@harmony/shared/types/api';
import type {
  ChannelCreatedPayload,
  ChannelUpdatedPayload,
  ChannelDeletedPayload,
} from '@harmony/shared/types/ws-events';

class ChannelsStore {
  channels = $state<ChannelWithUnread[]>([]);
  activeChannelId = $state<string | null>(null);
  dmChannels = $state<DirectMessageChannel[]>([]);

  get activeChannel(): ChannelWithUnread | undefined {
    return this.channels.find((c) => c.id === this.activeChannelId);
  }

  get textChannels(): ChannelWithUnread[] {
    return this.channels
      .filter((c) => c.type === ChannelType.TEXT)
      .sort((a, b) => a.position - b.position);
  }

  get voiceChannels(): ChannelWithUnread[] {
    return this.channels
      .filter((c) => c.type === ChannelType.VOICE)
      .sort((a, b) => a.position - b.position);
  }

  constructor() {
    // Listen to WebSocket events
    ws.on<ChannelCreatedPayload>('channel:created', (data) => {
      const exists = this.channels.some((c) => c.id === data.channel.id);
      if (!exists) {
        this.channels = [
          ...this.channels,
          { ...data.channel, unreadCount: 0, lastMessageAt: null },
        ];
      }
    });

    ws.on<ChannelUpdatedPayload>('channel:updated', (data) => {
      this.channels = this.channels.map((c) =>
        c.id === data.channel.id ? { ...c, ...data.channel } : c
      );
    });

    ws.on<ChannelDeletedPayload>('channel:deleted', (data) => {
      this.channels = this.channels.filter((c) => c.id !== data.channelId);
      if (this.activeChannelId === data.channelId) {
        this.activeChannelId = null;
      }
    });
  }

  async fetchChannels(): Promise<void> {
    const data = await api.get<ChannelWithUnread[]>('/channels');
    this.channels = data;
  }

  async fetchDmChannels(): Promise<void> {
    const data = await api.get<DirectMessageChannel[]>('/channels/dm');
    this.dmChannels = data;
  }

  setActiveChannel(id: string | null): void {
    this.activeChannelId = id;
  }

  async createChannel(data: CreateChannelRequest): Promise<ChannelWithUnread> {
    const channel = await api.post<ChannelWithUnread>('/channels', data);
    const exists = this.channels.some((c) => c.id === channel.id);
    if (!exists) {
      this.channels = [...this.channels, channel];
    }
    return channel;
  }

  async updateChannel(id: string, data: UpdateChannelRequest): Promise<ChannelWithUnread> {
    const updated = await api.patch<ChannelWithUnread>(`/channels/${id}`, data);
    this.channels = this.channels.map((c) => (c.id === id ? { ...c, ...updated } : c));
    return updated;
  }

  async deleteChannel(id: string): Promise<void> {
    await api.delete<void>(`/channels/${id}`);
    this.channels = this.channels.filter((c) => c.id !== id);
    if (this.activeChannelId === id) {
      this.activeChannelId = null;
    }
  }

  decrementUnread(channelId: string): void {
    this.channels = this.channels.map((c) =>
      c.id === channelId ? { ...c, unreadCount: Math.max(0, c.unreadCount - 1) } : c
    );
  }

  clearUnread(channelId: string): void {
    this.channels = this.channels.map((c) =>
      c.id === channelId ? { ...c, unreadCount: 0 } : c
    );
  }

  incrementUnread(channelId: string): void {
    // Only increment if it's not the currently active channel
    if (this.activeChannelId !== channelId) {
      this.channels = this.channels.map((c) =>
        c.id === channelId ? { ...c, unreadCount: c.unreadCount + 1 } : c
      );
    }
  }
}

export const channels = new ChannelsStore();
