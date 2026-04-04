import { randomUUID } from 'node:crypto';
import { db } from '../db/client';
import { getStorage } from '../storage';
import { env } from '../config/env';
import mime from 'mime-types';

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  path: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface PendingAttachment {
  id: string;
  path: string;
}

function toAttachment(row: {
  id: string;
  messageId: string;
  filename: string;
  path: string;
  mimeType: string;
  size: number;
}): Attachment {
  const storage = getStorage();
  return {
    id: row.id,
    messageId: row.messageId,
    filename: row.filename,
    path: row.path,
    url: storage.getUrl(row.path),
    mimeType: row.mimeType,
    size: row.size,
  };
}

export async function uploadAttachment(file: File, messageId: string): Promise<Attachment> {
  const maxBytes = env.MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`Attachment exceeds maximum size of ${env.MAX_ATTACHMENT_SIZE_MB} MB`);
  }

  const storage = getStorage();
  const id = randomUUID();
  const ext = file.name.split('.').pop() ?? '';
  const filename = ext ? `${id}.${ext}` : id;
  const mimeType = file.type || (mime.lookup(file.name) || 'application/octet-stream');

  const arrayBuffer = await file.arrayBuffer();
  const storedPath = await storage.save('attachments', filename, new Uint8Array(arrayBuffer));

  const record = await db.attachment.create({
    data: {
      id,
      messageId,
      filename: file.name,
      path: storedPath,
      mimeType,
      size: file.size,
    },
  });

  return toAttachment(record);
}

export async function getAttachment(id: string): Promise<Attachment | null> {
  const record = await db.attachment.findUnique({ where: { id } });
  if (!record) return null;
  return toAttachment(record);
}

export async function deleteAttachment(id: string): Promise<void> {
  const record = await db.attachment.findUnique({ where: { id } });
  if (!record) return;

  const storage = getStorage();
  await db.attachment.delete({ where: { id } });
  await storage.delete(record.path);
}

/**
 * Upload a file before the message is sent. Returns an ID that can be
 * referenced when creating the message. The attachment record is created
 * with a null messageId and updated when the message is created.
 */
export async function createPendingAttachment(
  file: File,
  _uploadedById: string,
): Promise<PendingAttachment> {
  const maxBytes = env.MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`Attachment exceeds maximum size of ${env.MAX_ATTACHMENT_SIZE_MB} MB`);
  }

  const storage = getStorage();
  const id = randomUUID();
  const ext = file.name.split('.').pop() ?? '';
  const filename = ext ? `${id}.${ext}` : id;
  const mimeType = file.type || (mime.lookup(file.name) || 'application/octet-stream');

  const arrayBuffer = await file.arrayBuffer();
  const storedPath = await storage.save('attachments', filename, new Uint8Array(arrayBuffer));

  await db.attachment.create({
    data: {
      id,
      messageId: null,
      filename: file.name,
      path: storedPath,
      mimeType,
      size: file.size,
    },
  });

  return { id, path: storedPath };
}
