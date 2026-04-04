import { api } from '$lib/api/client';
import { ws } from '$lib/api/ws';
import type { Notification, UnreadState } from '@harmony/shared/types/notification';
import type { NotificationNewPayload } from '@harmony/shared/types/ws-events';

class NotificationsStore {
  notifications = $state<Notification[]>([]);
  unreadStates = $state(new Map<string, UnreadState>());

  get totalUnread(): number {
    let total = 0;
    for (const state of this.unreadStates.values()) {
      total += state.unreadCount;
    }
    return total;
  }

  get unreadNotificationCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  constructor() {
    ws.on<NotificationNewPayload>('notification:new', (data) => {
      const exists = this.notifications.some((n) => n.id === data.notification.id);
      if (!exists) {
        this.notifications = [data.notification, ...this.notifications];
      }

      // Update unread state for the channel if applicable
      if (data.notification.channelId) {
        const channelId = data.notification.channelId;
        const existing = this.unreadStates.get(channelId);
        if (existing) {
          this.unreadStates = new Map(this.unreadStates).set(channelId, {
            ...existing,
            unreadCount: existing.unreadCount + 1,
            hasMention: existing.hasMention || data.notification.type === 'MENTION',
          });
        }
      }
    });
  }

  async fetchNotifications(): Promise<void> {
    const data = await api.get<Notification[]>('/notifications');
    this.notifications = data;
  }

  async fetchUnreadStates(): Promise<void> {
    const data = await api.get<UnreadState[]>('/notifications/unread');
    const newMap = new Map<string, UnreadState>();
    for (const state of data) {
      newMap.set(state.channelId, state);
    }
    this.unreadStates = newMap;
  }

  async markRead(id: string): Promise<void> {
    await api.post(`/notifications/${id}/read`);
    this.notifications = this.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
  }

  async markAllRead(channelId?: string): Promise<void> {
    if (channelId) {
      await api.post(`/notifications/read-all`, { channelId });
      this.notifications = this.notifications.map((n) =>
        n.channelId === channelId ? { ...n, read: true } : n
      );
    } else {
      await api.post(`/notifications/read-all`);
      this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    }
  }

  async acknowledgeChannel(channelId: string, messageId: string): Promise<void> {
    // Send read acknowledgement via WebSocket
    ws.send({ type: 'channel:read-ack', data: { channelId, messageId } });

    // Update local unread state
    const existing = this.unreadStates.get(channelId);
    if (existing) {
      this.unreadStates = new Map(this.unreadStates).set(channelId, {
        ...existing,
        unreadCount: 0,
        lastReadMessageId: messageId,
        hasMention: false,
      });
    } else {
      this.unreadStates = new Map(this.unreadStates).set(channelId, {
        channelId,
        unreadCount: 0,
        lastReadMessageId: messageId,
        hasMention: false,
      });
    }

    // Mark related notifications as read
    await this.markAllRead(channelId);
  }

  getUnreadState(channelId: string): UnreadState | undefined {
    return this.unreadStates.get(channelId);
  }
}

export const notifications = new NotificationsStore();
