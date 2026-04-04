import { api } from '$lib/api/client';
import { ws } from '$lib/api/ws';
import { UserStatus } from '@harmony/shared/types/user';
import type { PresenceChangedPayload } from '@harmony/shared/types/ws-events';

class PresenceStore {
  presenceMap = $state(new Map<string, UserStatus>());

  constructor() {
    ws.on<PresenceChangedPayload>('presence:changed', (data) => {
      this.presenceMap = new Map(this.presenceMap).set(data.userId, data.status);
    });
  }

  async updatePresence(status: UserStatus): Promise<void> {
    await api.patch('/users/me/status', { status });
    // The WS event will update the map for other users;
    // optimistically update locally via the ws client if needed.
    ws.send({ type: 'presence:update', data: { status } });
  }

  getPresence(userId: string): UserStatus {
    return this.presenceMap.get(userId) ?? UserStatus.OFFLINE;
  }

  setPresence(userId: string, status: UserStatus): void {
    this.presenceMap = new Map(this.presenceMap).set(userId, status);
  }

  initializeBulk(entries: Array<{ userId: string; status: UserStatus }>): void {
    const newMap = new Map(this.presenceMap);
    for (const entry of entries) {
      newMap.set(entry.userId, entry.status);
    }
    this.presenceMap = newMap;
  }
}

export const presence = new PresenceStore();
