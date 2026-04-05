import type { ClientEvent } from '@harmony/shared/types/ws-events';
import { NotificationType } from '@harmony/shared/types';
import { sendMessage, editMessage, deleteMessage } from '../messages/service';
import { addReaction, removeReaction } from '../messages/reactions';
import { createNotification } from '../notifications/service';
import { acknowledgeChannel } from '../notifications/service';
import { setPresence } from './presence';
import { startTyping, stopTyping, onTypingStop } from './typing';
import {
  broadcastToChannel,
  broadcastToAll,
  sendToUser,
  type WsData,
} from './server';
import type { ServerWebSocket } from 'bun';
import {
  joinVoiceRoom,
  setupVoiceTransports,
  handleVoiceLeave,
  handleVoiceProduce,
  handleVoiceConsume,
  handleVoiceConnectTransport,
  handleVoiceResumeConsumer,
  getChannelProducers,
} from '../voice/signaling';
import {
  updateVoiceState,
  getUserVoiceState,
  getVoiceChannelParticipants,
} from '../voice/rooms';
import { startStream, stopStream } from '../voice/streaming';
import { db } from '../db/client';
import { getStorage } from '../media/storage';
import { Permissions, hasPermission } from '@harmony/shared/constants/permissions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendError(ws: ServerWebSocket<WsData>, code: string, message: string): void {
  ws.send(JSON.stringify({ type: 'error', data: { code, message } }));
}

async function getUserBasePermissions(userId: string): Promise<bigint> {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: { role: { select: { permissions: true } } },
  });
  let perms = 0n;
  for (const ur of userRoles) {
    perms |= ur.role.permissions;
  }
  return perms;
}

// ---------------------------------------------------------------------------
// Register typing stop broadcast callback once at module load
// ---------------------------------------------------------------------------

// The server reference is not available at module-load time, so we store it
// and the broadcast happens via broadcastToChannel which requires it.
// We use a deferred approach: store pending stop broadcasts in a closure.
let _server: { publish: (topic: string, data: string) => void } | null = null;

export function setWsServer(server: { publish: (topic: string, data: string) => void }): void {
  _server = server;
}

export function getWsServer(): { publish: (topic: string, data: string) => void } | null {
  return _server;
}

// Wire up auto-expire typing stop → broadcast
onTypingStop((channelId, userId, username) => {
  if (!_server) return;
  broadcastToChannel(_server, channelId, {
    type: 'typing:update',
    data: { channelId, userId, username, isTyping: false },
  });
});

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

export async function handleWsMessage(
  ws: ServerWebSocket<WsData>,
  message: string | Buffer,
  server: { publish: (topic: string, data: string) => void },
): Promise<void> {
  // Keep a reference for the typing-stop callback
  if (!_server) {
    _server = server;
  }

  let event: ClientEvent;
  try {
    const raw = typeof message === 'string' ? message : message.toString();
    event = JSON.parse(raw) as ClientEvent;
  } catch {
    sendError(ws, 'PARSE_ERROR', 'Invalid message format');
    return;
  }

  const { userId, username } = ws.data;

  try {
    switch (event.type) {
      // -----------------------------------------------------------------------
      // Message events
      // -----------------------------------------------------------------------
      case 'message:send': {
        const { channelId, content, replyToId, attachmentIds } = event.data;

        if (!channelId || (!content?.trim() && !attachmentIds?.length)) {
          sendError(ws, 'INVALID_PAYLOAD', 'channelId and either content or attachmentIds are required');
          return;
        }

        let msg;
        try {
          msg = await sendMessage(channelId, userId, content, replyToId, attachmentIds);
        } catch (err: unknown) {
          const e = err as { statusCode?: number; message?: string };
          sendError(ws, 'SEND_FAILED', e.message ?? 'Failed to send message');
          return;
        }

        // Broadcast new message to everyone subscribed to the channel
        broadcastToChannel(server, channelId, {
          type: 'message:new',
          data: { message: msg },
        });

        // Check for @mentions and create notifications for mentioned users
        const mentionRegex = /@(\w+)/g;
        let match: RegExpExecArray | null;
        const mentionedUsernames = new Set<string>();

        while ((match = mentionRegex.exec(content)) !== null) {
          mentionedUsernames.add(match[1]);
        }

        if (mentionedUsernames.size > 0) {
          try {
            const mentionedUsers = await db.user.findMany({
              where: {
                username: { in: Array.from(mentionedUsernames) },
                id: { not: userId }, // Don't notify yourself
              },
              select: { id: true },
            });

            await Promise.allSettled(
              mentionedUsers.map(async (u: { id: string }) => {
                const notification = await createNotification(
                  u.id,
                  NotificationType.MENTION,
                  msg.id,
                  channelId,
                );
                sendToUser(u.id, {
                  type: 'notification:new',
                  data: { notification },
                });
              }),
            );
          } catch (err) {
            console.error('[ws] Failed to create mention notifications:', err);
          }
        }

        break;
      }

      case 'message:edit': {
        const { messageId, content } = event.data;

        if (!messageId || !content?.trim()) {
          sendError(ws, 'INVALID_PAYLOAD', 'messageId and content are required');
          return;
        }

        let updated;
        try {
          updated = await editMessage(messageId, userId, content);
        } catch (err: unknown) {
          const e = err as { statusCode?: number; message?: string };
          sendError(ws, 'EDIT_FAILED', e.message ?? 'Failed to edit message');
          return;
        }

        broadcastToChannel(server, updated.channelId, {
          type: 'message:updated',
          data: { message: updated },
        });

        break;
      }

      case 'message:delete': {
        const { messageId } = event.data;

        if (!messageId) {
          sendError(ws, 'INVALID_PAYLOAD', 'messageId is required');
          return;
        }

        // Look up channel before deletion for broadcasting
        const existing = await db.message.findUnique({
          where: { id: messageId },
          select: { channelId: true, authorId: true },
        });

        if (!existing) {
          sendError(ws, 'NOT_FOUND', 'Message not found');
          return;
        }

        const basePerms = await getUserBasePermissions(userId);
        const hasDeleteAny = hasPermission(basePerms, Permissions.DELETE_ANY_MESSAGE);

        try {
          await deleteMessage(messageId, userId, hasDeleteAny);
        } catch (err: unknown) {
          const e = err as { statusCode?: number; message?: string };
          sendError(ws, 'DELETE_FAILED', e.message ?? 'Failed to delete message');
          return;
        }

        broadcastToChannel(server, existing.channelId, {
          type: 'message:deleted',
          data: { messageId, channelId: existing.channelId },
        });

        break;
      }

      // -----------------------------------------------------------------------
      // Typing indicators
      // -----------------------------------------------------------------------
      case 'typing:start': {
        const { channelId } = event.data;

        if (!channelId) {
          sendError(ws, 'INVALID_PAYLOAD', 'channelId is required');
          return;
        }

        const typingData = startTyping(channelId, userId, username);
        if (typingData) {
          // Only broadcast on first start (not on timer reset)
          broadcastToChannel(server, channelId, {
            type: 'typing:update',
            data: { ...typingData, isTyping: true },
          });
        }

        break;
      }

      case 'typing:stop': {
        const { channelId } = event.data;

        if (!channelId) {
          sendError(ws, 'INVALID_PAYLOAD', 'channelId is required');
          return;
        }

        stopTyping(channelId, userId);
        broadcastToChannel(server, channelId, {
          type: 'typing:update',
          data: { channelId, userId, username, isTyping: false },
        });

        break;
      }

      // -----------------------------------------------------------------------
      // Presence
      // -----------------------------------------------------------------------
      case 'presence:update': {
        const { status } = event.data;

        if (!status) {
          sendError(ws, 'INVALID_PAYLOAD', 'status is required');
          return;
        }

        await setPresence(userId, status);

        broadcastToAll({
          type: 'presence:changed',
          data: { userId, status },
        });

        break;
      }

      // -----------------------------------------------------------------------
      // Voice events
      // -----------------------------------------------------------------------
      case 'voice:join': {
        const { channelId } = event.data;

        if (!channelId) {
          sendError(ws, 'INVALID_PAYLOAD', 'channelId is required');
          return;
        }

        // Phase 1: Join the room state. This is the critical step that makes
        // the user visible in the channel. It must succeed before anything else.
        try {
          await joinVoiceRoom(userId, channelId);
        } catch (err: unknown) {
          const e = err as { message?: string };
          sendError(ws, 'VOICE_JOIN_FAILED', e.message ?? 'Failed to join voice channel');
          return;
        }

        // Subscribe this connection to the voice channel topic so the user
        // receives broadcasts (mute/deafen state, other users joining, etc.)
        ws.subscribe(`channel:${channelId}`);

        // Broadcast to everyone (including the joiner) so all participants'
        // UIs update immediately.
        const participants = await getVoiceChannelParticipants(channelId);
        const participant = participants.find((p) => p.userId === userId);

        if (participant) {
          broadcastToChannel(server, channelId, {
            type: 'voice:user-joined',
            data: { channelId, participant },
          });
        }

        // Phase 2: Set up mediasoup transports. Failures here are non-fatal —
        // the user is already visible in the channel; they just won't have audio
        // until the media server is available.
        const transportResult = await setupVoiceTransports(userId, channelId);

        if (transportResult) {
          sendToUser(userId, {
            type: 'voice:transport-created',
            data: {
              direction: 'send',
              transport: transportResult.sendTransport,
              rtpCapabilities: transportResult.rtpCapabilities,
            },
          });
          sendToUser(userId, {
            type: 'voice:transport-created',
            data: { direction: 'recv', transport: transportResult.recvTransport },
          });

          // Notify the new joiner about all existing producers in this channel
          // so they can consume them immediately without waiting for new events.
          try {
            const existingProducers = await getChannelProducers(channelId);
            for (const { userId: producerUserId, producerInfo } of existingProducers) {
              // Don't notify the user about their own producers
              if (producerUserId === userId) continue;
              sendToUser(userId, {
                type: 'voice:new-producer',
                data: { userId: producerUserId, producerInfo },
              });
            }
          } catch (err) {
            console.warn('[voice] Failed to send existing producers to new joiner:', err);
          }
        } else {
          // Inform the client that audio is unavailable (media server down)
          // but the join itself succeeded.
          sendToUser(userId, {
            type: 'voice:transport-created',
            data: { direction: 'send', transport: null },
          });
        }

        break;
      }

      case 'voice:leave': {
        const voiceState = await getUserVoiceState(userId);
        const channelId = voiceState?.channelId;

        try {
          await handleVoiceLeave(userId);
        } catch (err) {
          console.error('[ws] voice:leave error:', err);
        }

        if (channelId) {
          broadcastToChannel(server, channelId, {
            type: 'voice:user-left',
            data: { channelId, userId },
          });
        }

        break;
      }

      case 'voice:mute': {
        const { muted } = event.data;
        const updated = await updateVoiceState(userId, { muted });

        if (updated) {
          broadcastToChannel(server, updated.channelId, {
            type: 'voice:state-update',
            data: { channelId: updated.channelId, userId, voiceState: updated },
          });
        }

        break;
      }

      case 'voice:deafen': {
        const { deafened } = event.data;
        const updated = await updateVoiceState(userId, { deafened });

        if (updated) {
          broadcastToChannel(server, updated.channelId, {
            type: 'voice:state-update',
            data: { channelId: updated.channelId, userId, voiceState: updated },
          });
        }

        break;
      }

      case 'voice:produce': {
        let result;
        try {
          result = await handleVoiceProduce(userId, event.data);
        } catch (err: unknown) {
          const e = err as { message?: string };
          sendError(ws, 'VOICE_PRODUCE_FAILED', e.message ?? 'Failed to produce');
          return;
        }

        // Confirm to the producing user
        sendToUser(userId, {
          type: 'voice:produced',
          data: { producerId: result.producerId },
        });

        // Notify all other participants in the voice channel
        const voiceState = await getUserVoiceState(userId);
        if (voiceState) {
          broadcastToChannel(server, voiceState.channelId, {
            type: 'voice:new-producer',
            data: {
              userId,
              producerInfo: {
                producerId: result.producerId,
                kind: event.data.kind,
                appData: event.data.appData,
              },
            },
          });
        }

        break;
      }

      case 'voice:consume': {
        let consumerInfo;
        try {
          consumerInfo = await handleVoiceConsume(userId, event.data);
        } catch (err: unknown) {
          const e = err as { message?: string };
          sendError(ws, 'VOICE_CONSUME_FAILED', e.message ?? 'Failed to consume');
          return;
        }

        if (!consumerInfo) {
          sendError(ws, 'VOICE_CONSUME_FAILED', 'Could not consume producer');
          return;
        }

        sendToUser(userId, {
          type: 'voice:consumed',
          data: { consumerInfo },
        });

        break;
      }

      case 'voice:resume-consumer': {
        try {
          await handleVoiceResumeConsumer(userId, event.data);
        } catch (err: unknown) {
          const e = err as { message?: string };
          sendError(ws, 'VOICE_RESUME_FAILED', e.message ?? 'Failed to resume consumer');
        }

        break;
      }

      case 'voice:connect-transport': {
        try {
          await handleVoiceConnectTransport(userId, event.data);
        } catch (err: unknown) {
          const e = err as { message?: string };
          sendError(ws, 'VOICE_TRANSPORT_FAILED', e.message ?? 'Failed to connect transport');
        }

        break;
      }

      // -----------------------------------------------------------------------
      // Streaming
      // -----------------------------------------------------------------------
      case 'stream:start': {
        const { type, config } = event.data;

        let channelId: string | undefined;
        try {
          const vs = await getUserVoiceState(userId);
          if (!vs) {
            sendError(ws, 'NOT_IN_VOICE', 'You must be in a voice channel to stream');
            return;
          }
          channelId = vs.channelId;
          await startStream(userId, type, config);
        } catch (err: unknown) {
          const e = err as { message?: string };
          sendError(ws, 'STREAM_START_FAILED', e.message ?? 'Failed to start stream');
          return;
        }

        broadcastToChannel(server, channelId!, {
          type: 'stream:started',
          data: { channelId: channelId!, userId, streamType: type },
        });

        break;
      }

      case 'stream:stop': {
        const vs = await getUserVoiceState(userId);
        if (!vs) break;

        await stopStream(userId);

        broadcastToChannel(server, vs.channelId, {
          type: 'stream:stopped',
          data: { channelId: vs.channelId, userId },
        });

        break;
      }

      // -----------------------------------------------------------------------
      // Soundboard
      // -----------------------------------------------------------------------
      case 'soundboard:play': {
        const { clipId, clipData } = event.data;

        const vs = await getUserVoiceState(userId);
        if (!vs) {
          sendError(ws, 'NOT_IN_VOICE', 'You must be in a voice channel to play sounds');
          return;
        }

        // Handle explicit stop request
        if (clipId === '__stop__') {
          broadcastToChannel(server, vs.channelId, {
            type: 'soundboard:playing',
            data: { channelId: vs.channelId, userId, clipName: '', stopped: true },
          });
          break;
        }

        // Resolve clip metadata for server clips
        let clipName = clipId;
        let clipUrl: string | undefined;
        let duration: number | undefined;
        try {
          const clip = await db.soundClip.findUnique({
            where: { id: clipId },
            select: { name: true, duration: true, path: true },
          });
          if (clip) {
            clipName = clip.name;
            duration = clip.duration;
            // Build the public URL the client can fetch to play the audio
            clipUrl = getStorage().getUrl(clip.path);
          }
        } catch {
          // Non-fatal: use clipId as fallback
        }

        broadcastToChannel(server, vs.channelId, {
          type: 'soundboard:playing',
          data: {
            channelId: vs.channelId,
            userId,
            clipName,
            duration,
            clipUrl,
            clipData, // Forward base64 for local clips
          },
        });

        break;
      }

      // -----------------------------------------------------------------------
      // Reactions
      // -----------------------------------------------------------------------
      case 'reaction:add': {
        const { messageId, emojiId, emojiUnicode } = event.data;

        if (!messageId || (!emojiId && !emojiUnicode)) {
          sendError(ws, 'INVALID_PAYLOAD', 'messageId and either emojiId or emojiUnicode are required');
          return;
        }

        let reaction;
        try {
          reaction = await addReaction(messageId, userId, emojiId, emojiUnicode);
        } catch (err: unknown) {
          const e = err as { statusCode?: number; message?: string };
          sendError(ws, 'REACTION_FAILED', e.message ?? 'Failed to add reaction');
          return;
        }

        // Look up channel for broadcasting
        const msgForReaction = await db.message.findUnique({
          where: { id: messageId },
          select: { channelId: true },
        });

        if (msgForReaction) {
          broadcastToChannel(server, msgForReaction.channelId, {
            type: 'reaction:added',
            data: { messageId, channelId: msgForReaction.channelId, reaction },
          });
        }

        break;
      }

      case 'reaction:remove': {
        const { messageId, emojiId, emojiUnicode } = event.data;

        if (!messageId || (!emojiId && !emojiUnicode)) {
          sendError(ws, 'INVALID_PAYLOAD', 'messageId and either emojiId or emojiUnicode are required');
          return;
        }

        try {
          await removeReaction(messageId, userId, emojiId, emojiUnicode);
        } catch (err: unknown) {
          const e = err as { message?: string };
          sendError(ws, 'REACTION_FAILED', e.message ?? 'Failed to remove reaction');
          return;
        }

        const msgForReaction = await db.message.findUnique({
          where: { id: messageId },
          select: { channelId: true },
        });

        if (msgForReaction) {
          broadcastToChannel(server, msgForReaction.channelId, {
            type: 'reaction:removed',
            data: {
              messageId,
              channelId: msgForReaction.channelId,
              emojiId,
              emojiUnicode,
              userId,
            },
          });
        }

        break;
      }

      // -----------------------------------------------------------------------
      // Channel read acknowledgement
      // -----------------------------------------------------------------------
      case 'channel:read-ack': {
        const { channelId, messageId } = event.data;

        if (!channelId || !messageId) {
          sendError(ws, 'INVALID_PAYLOAD', 'channelId and messageId are required');
          return;
        }

        try {
          await acknowledgeChannel(userId, channelId, messageId);
        } catch (err) {
          console.error('[ws] channel:read-ack error:', err);
        }

        break;
      }

      default: {
        // TypeScript exhaustive check — cast to satisfy the compiler
        const exhaustive = event as { type: string };
        sendError(ws, 'UNKNOWN_EVENT', `Unknown event type: ${exhaustive.type}`);
      }
    }
  } catch (err) {
    console.error('[ws] Unhandled error in message handler:', err);
    sendError(ws, 'INTERNAL_ERROR', 'An internal error occurred');
  }
}
