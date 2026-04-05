import { verifyAccessToken } from '../auth/jwt';
import { db } from '../db/client';
import { getAllChannels } from '../channels/service';
import { setPresence, removePresence } from './presence';
import { handleVoiceLeave } from '../voice/signaling';
import { getUserVoiceState, getAllVoiceParticipants } from '../voice/rooms';
import { UserStatus } from '@harmony/shared/types/user';
import type { ServerWebSocket } from 'bun';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WsData {
  userId: string;
  username: string;
}

// Bun's typed WebSocket for this server
type BunWebSocket = ServerWebSocket<WsData>;

// ---------------------------------------------------------------------------
// Connection tracking
// ---------------------------------------------------------------------------

/** userId -> Set of open WebSocket connections (supports multiple tabs) */
const connections = new Map<string, Set<ServerWebSocket<WsData>>>();

export function getConnections(): Map<string, Set<ServerWebSocket<WsData>>> {
  return connections;
}

export function getUserConnections(userId: string): Set<ServerWebSocket<WsData>> | undefined {
  return connections.get(userId);
}

// ---------------------------------------------------------------------------
// Broadcast helpers
// ---------------------------------------------------------------------------

/**
 * Publish a message to a channel topic via Bun's built-in pub/sub.
 * All WebSocket connections subscribed to that topic will receive it.
 */
export function broadcastToChannel(
  server: { publish: (topic: string, data: string) => void },
  channelId: string,
  event: unknown,
  _excludeUserId?: string,
): void {
  server.publish(`channel:${channelId}`, JSON.stringify(event));
}

/**
 * Send a message directly to all open connections owned by a specific user.
 */
export function sendToUser(userId: string, event: unknown): void {
  const conns = connections.get(userId);
  if (!conns) return;
  const message = JSON.stringify(event);
  for (const ws of conns) {
    // Bun's ServerWebSocket.readyState: 1 = OPEN
    if (ws.readyState === 1) {
      ws.send(message);
    }
  }
}

/**
 * Broadcast to all currently connected users.
 */
export function broadcastToAll(event: unknown, excludeUserId?: string): void {
  const message = JSON.stringify(event);
  for (const [userId, conns] of connections) {
    if (excludeUserId && userId === excludeUserId) continue;
    for (const ws of conns) {
      if (ws.readyState === 1) {
        ws.send(message);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Upgrade handler
// ---------------------------------------------------------------------------

export async function handleWsUpgrade(
  req: Request,
  server: { upgrade: (req: Request, opts: { data: WsData }) => boolean },
): Promise<Response | undefined> {
  const url = new URL(req.url);

  // Accept token from query param or Authorization header
  let token = url.searchParams.get('token');
  if (!token) {
    const authHeader = req.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Fetch the user's username from the database
  let username = '';
  try {
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { username: true },
    });
    username = user?.username ?? '';
  } catch {
    // Non-fatal — proceed without username
  }

  const upgraded = server.upgrade(req, {
    data: { userId: payload.userId, username } satisfies WsData,
  });

  if (upgraded) return undefined;
  return new Response('WebSocket upgrade failed', { status: 400 });
}

// ---------------------------------------------------------------------------
// Open handler
// ---------------------------------------------------------------------------

export async function handleWsOpen(ws: ServerWebSocket<WsData>): Promise<void> {
  const { userId } = ws.data;

  // Track connection
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId)!.add(ws);

  // Subscribe to user-specific topic for DMs and notifications
  ws.subscribe(`user:${userId}`);

  // Subscribe to all accessible channels
  try {
    const channels = await getAllChannels();
    for (const channel of channels) {
      ws.subscribe(`channel:${channel.id}`);
    }
  } catch (err) {
    console.error('[ws] Failed to subscribe to channels on open:', err);
  }

  // Mark user as online
  try {
    await setPresence(userId, UserStatus.ONLINE);
  } catch (err) {
    console.error('[ws] Failed to set presence:', err);
  }

  // Broadcast presence change to all connected users
  broadcastToAll(
    {
      type: 'presence:changed',
      data: { userId, status: 'ONLINE' },
    },
    // Don't exclude self — the user's other tabs should also receive this
  );

  // Send current voice state snapshot so the client shows existing participants
  try {
    const channels = await getAllVoiceParticipants();
    ws.send(JSON.stringify({ type: 'voice:state-sync', data: { channels } }));
  } catch (err) {
    console.error('[ws] Failed to send voice state sync:', err);
  }
}

// ---------------------------------------------------------------------------
// Close handler
// ---------------------------------------------------------------------------

export async function handleWsClose(ws: ServerWebSocket<WsData>): Promise<void> {
  const { userId } = ws.data;

  // Remove this specific connection
  const conns = connections.get(userId);
  if (conns) {
    conns.delete(ws);
    if (conns.size === 0) {
      connections.delete(userId);

      // No more connections — user is offline
      try {
        await removePresence(userId);
      } catch (err) {
        console.error('[ws] Failed to remove presence:', err);
      }

      // Broadcast offline status to all remaining connected users
      broadcastToAll({ type: 'presence:changed', data: { userId, status: 'OFFLINE' } });

      // Clean up voice state if the user was in a voice channel
      try {
        const voiceState = await getUserVoiceState(userId);
        if (voiceState) {
          await handleVoiceLeave(userId);
        }
      } catch (err) {
        console.error('[ws] Failed to clean up voice state on close:', err);
      }
    }
  }
}
