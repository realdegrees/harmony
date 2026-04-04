import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client';
import { getStorage } from '../storage';
import { convertToOpus, getAudioDuration, isValidAudioFormat } from './convert';
import { env } from '../config/env';
import type { SoundClip } from '@harmony/shared/types/soundboard';
import { AssetScope } from '@harmony/shared/types/emoji';

function toSoundClip(row: {
  id: string;
  name: string;
  path: string;
  uploadedById: string;
  scope: string;
  userId: string | null;
  duration: number;
  createdAt: Date;
}): SoundClip {
  const storage = getStorage();
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    url: storage.getUrl(row.path),
    uploadedById: row.uploadedById,
    scope: row.scope as AssetScope,
    userId: row.userId,
    duration: row.duration,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function uploadSound(
  file: File,
  name: string,
  uploadedById: string,
  scope: AssetScope,
  userId?: string,
): Promise<SoundClip> {
  const maxBytes = env.MAX_SOUND_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`Sound file exceeds maximum size of ${env.MAX_SOUND_SIZE_MB} MB`);
  }

  if (!isValidAudioFormat(file.type)) {
    throw new Error(`Unsupported audio format: ${file.type}`);
  }

  const storage = getStorage();
  const id = randomUUID();
  const tempDir = os.tmpdir();
  const ext = file.name.split('.').pop() ?? 'mp3';
  const tempInput = path.join(tempDir, `sound-in-${id}.${ext}`);
  const tempOutput = path.join(tempDir, `sound-out-${id}.ogg`);

  try {
    const arrayBuffer = await file.arrayBuffer();
    await Bun.write(tempInput, new Uint8Array(arrayBuffer));

    // Check duration before conversion
    const duration = await getAudioDuration(tempInput);
    if (duration > env.MAX_SOUND_DURATION_SECONDS) {
      throw new Error(
        `Sound duration (${Math.round(duration)}s) exceeds maximum of ${env.MAX_SOUND_DURATION_SECONDS}s`,
      );
    }

    await convertToOpus(tempInput, tempOutput);

    const outputFile = Bun.file(tempOutput);
    const outputData = new Uint8Array(await outputFile.arrayBuffer());
    const filename = `${id}.ogg`;
    const storedPath = await storage.save('sounds', filename, outputData);

    const record = await db.soundClip.create({
      data: {
        id,
        name,
        path: storedPath,
        uploadedById,
        scope,
        userId: scope === AssetScope.USER ? (userId ?? uploadedById) : null,
        duration,
      },
    });

    return toSoundClip(record);
  } finally {
    await fs.unlink(tempInput).catch(() => {});
    await fs.unlink(tempOutput).catch(() => {});
  }
}

export async function getServerSounds(): Promise<SoundClip[]> {
  const records = await db.soundClip.findMany({
    where: { scope: AssetScope.SERVER },
    orderBy: { createdAt: 'asc' },
  });
  return records.map(toSoundClip);
}

export async function getUserSounds(userId: string): Promise<SoundClip[]> {
  const records = await db.soundClip.findMany({
    where: { scope: AssetScope.USER, userId },
    orderBy: { createdAt: 'asc' },
  });
  return records.map(toSoundClip);
}

export async function deleteSound(
  id: string,
  userId: string,
  hasManagePermission: boolean,
): Promise<void> {
  const record = await db.soundClip.findUnique({ where: { id } });
  if (!record) {
    throw new Error('Sound clip not found');
  }

  if (record.uploadedById !== userId && !hasManagePermission) {
    throw new Error('Forbidden: you do not have permission to delete this sound clip');
  }

  const storage = getStorage();
  await db.soundClip.delete({ where: { id } });
  await storage.delete(record.path);
}
