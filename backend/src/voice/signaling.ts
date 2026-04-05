import { mediaClient } from './media-client';
import {
  joinVoiceChannel,
  leaveVoiceChannel,
  getUserVoiceState,
  getVoiceChannelParticipants,
} from './rooms';
import type {
  VoiceProducePayload,
  VoiceConsumePayload,
  VoiceConnectTransportPayload,
  VoiceResumeConsumerPayload,
} from '@harmony/shared/types/ws-events';
import type { ConsumerInfo, ProducerInfo } from '@harmony/shared/types/voice';

interface ProducerRecord {
  producerId: string;
  kind: 'audio' | 'video';
  appData: Record<string, unknown>;
}

interface UserTransports {
  sendTransportId: string | null;
  recvTransportId: string | null;
  producers: ProducerRecord[];
  consumerIds: string[];
}

// In-memory map of userId -> transport/producer/consumer IDs
const userTransports = new Map<string, UserTransports>();

function getOrCreateUserTransports(userId: string): UserTransports {
  let entry = userTransports.get(userId);
  if (!entry) {
    entry = {
      sendTransportId: null,
      recvTransportId: null,
      producers: [],
      consumerIds: [],
    };
    userTransports.set(userId, entry);
  }
  return entry;
}

/**
 * Join a voice channel's room state.
 * This always succeeds (barring DB errors) and is what makes the user
 * visible to other participants. Media transport creation is separate.
 */
export async function joinVoiceRoom(
  userId: string,
  channelId: string,
): Promise<void> {
  await joinVoiceChannel(userId, channelId);
}

/**
 * Set up mediasoup transports for a user already in a voice room.
 * Returns null if the media server is unreachable — callers should
 * treat this as a degraded (visible but no audio) state.
 */
export async function setupVoiceTransports(
  userId: string,
  channelId: string,
): Promise<{ rtpCapabilities: unknown; sendTransport: unknown; recvTransport: unknown } | null> {
  try {
    const routerData = await mediaClient.createRouter(channelId) as {
      rtpCapabilities: unknown;
    };

    const [sendTransport, recvTransport] = await Promise.all([
      mediaClient.createTransport(channelId) as Promise<{ transportId: string } & Record<string, unknown>>,
      mediaClient.createTransport(channelId) as Promise<{ transportId: string } & Record<string, unknown>>,
    ]);

    const entry = getOrCreateUserTransports(userId);
    entry.sendTransportId = sendTransport.transportId;
    entry.recvTransportId = recvTransport.transportId;

    return {
      rtpCapabilities: routerData.rtpCapabilities,
      sendTransport,
      recvTransport,
    };
  } catch (err) {
    console.warn(`[voice] Media transport setup failed for user ${userId} in channel ${channelId}:`, err);
    return null;
  }
}

/** @deprecated Use joinVoiceRoom + setupVoiceTransports separately */
export async function handleVoiceJoin(
  userId: string,
  channelId: string,
): Promise<{ rtpCapabilities: unknown; sendTransport: unknown; recvTransport: unknown }> {
  await joinVoiceRoom(userId, channelId);
  const result = await setupVoiceTransports(userId, channelId);
  if (!result) throw new Error('Media server unavailable');
  return result;
}

export async function handleVoiceLeave(userId: string): Promise<void> {
  const entry = userTransports.get(userId);

  if (entry) {
    // Close all consumers
    await Promise.allSettled(
      entry.consumerIds.map((id) => mediaClient.closeConsumer(id)),
    );

    // Close all producers
    await Promise.allSettled(
      entry.producers.map((p) => mediaClient.closeProducer(p.producerId)),
    );

    // Close transports
    const transportCloses: Promise<unknown>[] = [];
    if (entry.sendTransportId) {
      transportCloses.push(mediaClient.closeTransport(entry.sendTransportId));
    }
    if (entry.recvTransportId) {
      transportCloses.push(mediaClient.closeTransport(entry.recvTransportId));
    }
    await Promise.allSettled(transportCloses);

    userTransports.delete(userId);
  }

  await leaveVoiceChannel(userId);
}

export async function handleVoiceProduce(
  userId: string,
  data: VoiceProducePayload,
): Promise<{ producerId: string }> {
  const entry = getOrCreateUserTransports(userId);

  if (!entry.sendTransportId) {
    throw new Error('No send transport found for user; call voice:join first');
  }

  const result = await mediaClient.produce(
    entry.sendTransportId,
    data.kind,
    data.rtpParameters,
    data.appData,
  ) as { producerId: string };

  entry.producers.push({
    producerId: result.producerId,
    kind: data.kind,
    appData: data.appData,
  });
  return { producerId: result.producerId };
}

export async function handleVoiceConsume(
  userId: string,
  data: VoiceConsumePayload,
): Promise<ConsumerInfo | null> {
  const entry = getOrCreateUserTransports(userId);

  if (!entry.recvTransportId) {
    throw new Error('No recv transport found for user; call voice:join first');
  }

  const voiceState = await getUserVoiceState(userId);
  if (!voiceState) return null;

  try {
    const result = await mediaClient.consume(
      entry.recvTransportId,
      data.producerId,
      data.rtpCapabilities,
      voiceState.channelId,
    ) as ConsumerInfo;

    entry.consumerIds.push(result.consumerId);
    return result;
  } catch {
    return null;
  }
}

export async function handleVoiceConnectTransport(
  userId: string,
  data: VoiceConnectTransportPayload,
): Promise<void> {
  await mediaClient.connectTransport(data.transportId, data.dtlsParameters);
}

export async function handleVoiceResumeConsumer(
  userId: string,
  data: VoiceResumeConsumerPayload,
): Promise<void> {
  await mediaClient.resumeConsumer(data.consumerId);
}

/**
 * Returns all active producers for every user currently in a channel,
 * so that a newly-joining user can consume them.
 */
export async function getChannelProducers(
  channelId: string,
): Promise<Array<{ userId: string; producerInfo: ProducerInfo }>> {
  const participants = await getVoiceChannelParticipants(channelId);
  const result: Array<{ userId: string; producerInfo: ProducerInfo }> = [];

  for (const participant of participants) {
    const entry = userTransports.get(participant.userId);
    if (!entry) continue;
    for (const p of entry.producers) {
      result.push({
        userId: participant.userId,
        producerInfo: {
          producerId: p.producerId,
          kind: p.kind,
          appData: p.appData,
        },
      });
    }
  }

  return result;
}
