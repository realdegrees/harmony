import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { db } from '../db/client';
import { getStorage } from '../storage';
import { convertToWebP, isValidImageFormat } from './convert';
import { env } from '../config/env';
import type { CustomEmoji } from '@harmony/shared/types/emoji';
import { AssetScope } from '@harmony/shared/types/emoji';

function toCustomEmoji(row: {
  id: string;
  name: string;
  path: string;
  uploadedById: string;
  scope: string;
  userId: string | null;
  createdAt: Date;
}): CustomEmoji {
  const storage = getStorage();
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    url: storage.getUrl(row.path),
    uploadedById: row.uploadedById,
    scope: row.scope as AssetScope,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function uploadEmoji(
  file: File,
  name: string,
  uploadedById: string,
  scope: AssetScope,
  userId?: string,
): Promise<CustomEmoji> {
  const maxBytes = env.MAX_EMOJI_SIZE_KB * 1024;
  if (file.size > maxBytes) {
    throw new Error(`Emoji file exceeds maximum size of ${env.MAX_EMOJI_SIZE_KB} KB`);
  }

  if (!isValidImageFormat(file.type)) {
    throw new Error(`Unsupported image format: ${file.type}`);
  }

  const storage = getStorage();
  const id = randomUUID();
  const tempDir = os.tmpdir();
  const ext = file.name.split('.').pop() ?? 'png';
  const tempInput = path.join(tempDir, `emoji-in-${id}.${ext}`);
  const tempOutput = path.join(tempDir, `emoji-out-${id}.webp`);

  try {
    const arrayBuffer = await file.arrayBuffer();
    await Bun.write(tempInput, new Uint8Array(arrayBuffer));
    await convertToWebP(tempInput, tempOutput);

    const outputFile = Bun.file(tempOutput);
    const outputData = new Uint8Array(await outputFile.arrayBuffer());
    const filename = `${id}.webp`;
    const storedPath = await storage.save('emojis', filename, outputData);

    const record = await db.customEmoji.create({
      data: {
        id,
        name,
        path: storedPath,
        uploadedById,
        scope,
        userId: scope === AssetScope.USER ? (userId ?? uploadedById) : null,
      },
    });

    return toCustomEmoji(record);
  } finally {
    await fs.unlink(tempInput).catch(() => {});
    await fs.unlink(tempOutput).catch(() => {});
  }
}

export async function getServerEmojis(): Promise<CustomEmoji[]> {
  const records = await db.customEmoji.findMany({
    where: { scope: AssetScope.SERVER },
    orderBy: { createdAt: 'asc' },
  });
  return records.map(toCustomEmoji);
}

export async function getUserEmojis(userId: string): Promise<CustomEmoji[]> {
  const records = await db.customEmoji.findMany({
    where: { scope: AssetScope.USER, userId },
    orderBy: { createdAt: 'asc' },
  });
  return records.map(toCustomEmoji);
}

export async function deleteEmoji(
  id: string,
  userId: string,
  hasManagePermission: boolean,
): Promise<void> {
  const record = await db.customEmoji.findUnique({ where: { id } });
  if (!record) {
    throw new Error('Emoji not found');
  }

  if (record.uploadedById !== userId && !hasManagePermission) {
    throw new Error('Forbidden: you do not have permission to delete this emoji');
  }

  const storage = getStorage();
  await db.customEmoji.delete({ where: { id } });
  await storage.delete(record.path);
}
