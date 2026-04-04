import type { ClientEvent, ServerEvent } from '@harmony/shared/types/ws-events';
import { resolveWsUrl } from '$lib/utils/tauri';

type EventHandler<T = unknown> = (data: T) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string = '';
  private token: string = '';
  private handlers = new Map<string, Set<EventHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private connected = false;
  private intentionalClose = false;

  connect(token: string): void {
    this.token = token;
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    const wsUrl = resolveWsUrl('/ws');
    if (!wsUrl) {
      console.error('[ws] No server URL configured — cannot connect WebSocket.');
      return;
    }
    this.url = `${wsUrl}?token=${token}`;
    this.doConnect();
  }

  private doConnect(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      this.ws.close();
      this.ws = null;
    }

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connected', {});
    };

    this.ws.onclose = (event) => {
      this.connected = false;
      this.emit('disconnected', { code: event.code, reason: event.reason });

      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.emit('error', { message: 'WebSocket error' });
    };

    this.ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as ServerEvent;
        this.emit(parsed.type, parsed.data);
      } catch {
        console.error('[ws] Failed to parse message:', event.data);
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[ws] Max reconnect attempts reached');
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Exponential backoff: 1s, 2s, 4s, 8s... capped at 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (!this.intentionalClose) {
        this.doConnect();
      }
    }, delay);
  }

  disconnect(): void {
    this.intentionalClose = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close(1000, 'Client disconnected');
      this.ws = null;
    }

    this.connected = false;
  }

  send(event: ClientEvent): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    } else {
      console.warn('[ws] Cannot send — not connected:', event.type);
    }
  }

  on<T>(eventType: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler);
    return () => this.off(eventType, handler as EventHandler);
  }

  off(eventType: string, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  private emit(eventType: string, data: unknown): void {
    const set = this.handlers.get(eventType);
    if (set) {
      for (const handler of set) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[ws] Handler error for "${eventType}":`, err);
        }
      }
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }
}

export const ws = new WebSocketClient();
