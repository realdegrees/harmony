import { mediaClient } from './media-client';
import {
  joinVoiceChannel,
  leaveVoiceChannel,
  getUserVoiceState,
} from './rooms';
import type {
  VoiceProducePayload,
  VoiceConsumePayload,
  VoiceConnectTransportPayload,
  VoiceResumeConsumerPayload,
} from '@harmony/shared/types/ws-events';
import type { ConsumerInfo } from '@harmony/shared/types/voice';

interface UserTransports {
  sendTransportId: string | null;
  recvTransportId: string | null;
  producerIds: string[];
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
      producerIds: [],
      consumerIds: [],
    };
    userTransports.set(userId, entry);
  }
  return entry;
}

export async function handleVoiceJoin(
  userId: string,
  channelId: string,
): Promise<{ rtpCapabilities: unknown; sendTransport: unknown; recvTransport: unknown }> {
  // Join room state
  await joinVoiceChannel(userId, channelId);

  // Create or fetch the mediasoup router for this channel
  const routerData = await mediaClient.createRouter(channelId) as {
    rtpCapabilities: unknown;
  };

  // Create send and receive transports for this user
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
      entry.producerIds.map((id) => mediaClient.closeProducer(id)),
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

  entry.producerIds.push(result.producerId);
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
      // rtpCapabilities are passed from the client to the media server when consuming
      undefined,
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
