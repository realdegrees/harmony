import { api } from '$lib/api/client';
import { ws } from '$lib/api/ws';
import { channels } from '$lib/stores/channels.svelte';
import type { Message, PaginatedMessages } from '@harmony/shared/types/message';
import type {
  MessageNewPayload,
  MessageUpdatedPayload,
  MessageDeletedPayload,
} from '@harmony/shared/types/ws-events';

const DEFAULT_LIMIT = 50;

class MessagesStore {
  messagesByChannel = $state(new Map<string, Message[]>());
  hasMore = $state(new Map<string, boolean>());
  cursors = $state(new Map<string, string | null>());
  isLoading = $state(false);

  constructor() {
    ws.on<MessageNewPayload>('message:new', (data) => {
      const { message } = data;
      const existing = this.messagesByChannel.get(message.channelId) ?? [];
      // Avoid duplicates
      if (!existing.some((m) => m.id === message.id)) {
        this.messagesByChannel = new Map(this.messagesByChannel).set(message.channelId, [
          ...existing,
          message,
        ]);
      }
      // Increment unread count if the message is not in the currently active channel
      if (message.channelId !== channels.activeChannelId) {
        channels.incrementUnread(message.channelId);
      }
    });

    ws.on<MessageUpdatedPayload>('message:updated', (data) => {
      const { message } = data;
      const existing = this.messagesByChannel.get(message.channelId);
      if (existing) {
        this.messagesByChannel = new Map(this.messagesByChannel).set(
          message.channelId,
          existing.map((m) => (m.id === message.id ? message : m))
        );
      }
    });

    ws.on<MessageDeletedPayload>('message:deleted', (data) => {
      const existing = this.messagesByChannel.get(data.channelId);
      if (existing) {
        this.messagesByChannel = new Map(this.messagesByChannel).set(
          data.channelId,
          existing.filter((m) => m.id !== data.messageId)
        );
      }
    });
  }

  async fetchMessages(channelId: string, cursor?: string): Promise<void> {
    this.isLoading = true;
    try {
      const params = new URLSearchParams({ limit: String(DEFAULT_LIMIT) });
      if (cursor) params.set('cursor', cursor);

      const data = await api.get<PaginatedMessages>(
        `/channels/${channelId}/messages?${params.toString()}`
      );

      const newHasMore = new Map(this.hasMore);
      newHasMore.set(channelId, data.hasMore);
      this.hasMore = newHasMore;

      const newCursors = new Map(this.cursors);
      newCursors.set(channelId, data.cursor);
      this.cursors = newCursors;

      // Prepend older messages (they come back oldest-first from cursor pagination)
      const existing = this.messagesByChannel.get(channelId) ?? [];
      const merged = cursor
        ? [...data.messages, ...existing]
        : data.messages;

      this.messagesByChannel = new Map(this.messagesByChannel).set(channelId, merged);
    } finally {
      this.isLoading = false;
    }
  }

  async loadMore(channelId: string): Promise<void> {
    const cursor = this.cursors.get(channelId);
    const more = this.hasMore.get(channelId);
    if (!more || !cursor || this.isLoading) return;
    await this.fetchMessages(channelId, cursor);
  }

  async sendMessage(
    channelId: string,
    content: string,
    replyToId?: string,
    attachmentIds?: string[],
  ): Promise<Message> {
    const message = await api.post<Message>(`/channels/${channelId}/messages`, {
      content,
      replyToId,
      attachmentIds,
    });
    // Optimistic add — WS event will also arrive, deduplication handles it
    const existing = this.messagesByChannel.get(channelId) ?? [];
    if (!existing.some((m) => m.id === message.id)) {
      this.messagesByChannel = new Map(this.messagesByChannel).set(channelId, [
        ...existing,
        message,
      ]);
    }
    return message;
  }

  async editMessage(id: string, content: string): Promise<void> {
    const updated = await api.patch<Message>(`/messages/${id}`, { content });
    const existing = this.messagesByChannel.get(updated.channelId);
    if (existing) {
      this.messagesByChannel = new Map(this.messagesByChannel).set(
        updated.channelId,
        existing.map((m) => (m.id === id ? updated : m))
      );
    }
  }

  async deleteMessage(id: string): Promise<void> {
    // Find the channel for this message first
    let channelId: string | null = null;
    for (const [cid, msgs] of this.messagesByChannel) {
      if (msgs.some((m) => m.id === id)) {
        channelId = cid;
        break;
      }
    }

    await api.delete<void>(`/messages/${id}`);

    if (channelId) {
      const existing = this.messagesByChannel.get(channelId);
      if (existing) {
        this.messagesByChannel = new Map(this.messagesByChannel).set(
          channelId,
          existing.filter((m) => m.id !== id)
        );
      }
    }
  }

  getMessages(channelId: string): Message[] {
    return this.messagesByChannel.get(channelId) ?? [];
  }

  clearChannel(channelId: string): void {
    const newMap = new Map(this.messagesByChannel);
    newMap.delete(channelId);
    this.messagesByChannel = newMap;

    const newHasMore = new Map(this.hasMore);
    newHasMore.delete(channelId);
    this.hasMore = newHasMore;

    const newCursors = new Map(this.cursors);
    newCursors.delete(channelId);
    this.cursors = newCursors;
  }
}

export const messages = new MessagesStore();
