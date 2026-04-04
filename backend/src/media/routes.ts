import path from 'node:path';
import { json, error } from '../utils/response';
import { getStorage } from '../storage';
import { uploadEmoji, getServerEmojis, getUserEmojis, deleteEmoji } from './emojis';
import { uploadSound, getServerSounds, getUserSounds, deleteSound } from './soundboard';
import { createPendingAttachment } from './attachments';
import {
  searchGifs,
  getTrendingGifs,
  addFavoriteGif,
  removeFavoriteGif,
  getFavoriteGifs,
} from './giphy';
import { AssetScope } from '@harmony/shared/types/emoji';
import type { GiphyGif } from '@harmony/shared/types/api';
import mime from 'mime-types';

export async function handleMediaRoute(
  req: Request,
  reqPath: string,
  userId: string,
): Promise<Response | null> {
  const method = req.method.toUpperCase();

  // -------------------------------------------------------------------------
  // Static file serving: GET /api/uploads/*
  // -------------------------------------------------------------------------
  if (method === 'GET' && reqPath.startsWith('/api/uploads/')) {
    const filePath = reqPath.slice('/api/uploads/'.length);
    const storage = getStorage();
    const data = await storage.read(filePath);
    if (!data) {
      return error('File not found', 404);
    }
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': mimeType },
    });
  }

  // -------------------------------------------------------------------------
  // Emojis
  // -------------------------------------------------------------------------
  if (reqPath === '/api/emojis') {
    if (method === 'POST') {
      try {
        const formData = await req.formData();
        const name = formData.get('name');
        const file = formData.get('file');
        const scopeRaw = formData.get('scope');

        if (typeof name !== 'string' || !name.trim()) {
          return error('Missing or invalid field: name');
        }
        if (!(file instanceof File)) {
          return error('Missing or invalid field: file');
        }

        const scope =
          scopeRaw === AssetScope.USER ? AssetScope.USER : AssetScope.SERVER;

        const emoji = await uploadEmoji(file, name.trim(), userId, scope, userId);
        return json(emoji, 201);
      } catch (e) {
        return error((e as Error).message);
      }
    }

    if (method === 'GET') {
      const emojis = await getServerEmojis();
      return json(emojis);
    }
  }

  if (reqPath === '/api/emojis/user') {
    if (method === 'GET') {
      const emojis = await getUserEmojis(userId);
      return json(emojis);
    }
  }

  const emojiDeleteMatch = reqPath.match(/^\/api\/emojis\/([^/]+)$/);
  if (emojiDeleteMatch && method === 'DELETE') {
    const id = emojiDeleteMatch[1];
    try {
      // hasManagePermission – for simplicity the requester can always delete their
      // own emojis; admin check is left to higher-level middleware if needed.
      await deleteEmoji(id, userId, false);
      return json({ success: true });
    } catch (e) {
      const msg = (e as Error).message;
      const status = msg.startsWith('Forbidden') ? 403 : msg.includes('not found') ? 404 : 400;
      return error(msg, status);
    }
  }

  // -------------------------------------------------------------------------
  // Sounds
  // -------------------------------------------------------------------------
  if (reqPath === '/api/sounds') {
    if (method === 'POST') {
      try {
        const formData = await req.formData();
        const name = formData.get('name');
        const file = formData.get('file');
        const scopeRaw = formData.get('scope');

        if (typeof name !== 'string' || !name.trim()) {
          return error('Missing or invalid field: name');
        }
        if (!(file instanceof File)) {
          return error('Missing or invalid field: file');
        }

        const scope =
          scopeRaw === AssetScope.USER ? AssetScope.USER : AssetScope.SERVER;

        const clip = await uploadSound(file, name.trim(), userId, scope, userId);
        return json(clip, 201);
      } catch (e) {
        return error((e as Error).message);
      }
    }

    if (method === 'GET') {
      const sounds = await getServerSounds();
      return json(sounds);
    }
  }

  if (reqPath === '/api/sounds/user') {
    if (method === 'GET') {
      const sounds = await getUserSounds(userId);
      return json(sounds);
    }
  }

  const soundDeleteMatch = reqPath.match(/^\/api\/sounds\/([^/]+)$/);
  if (soundDeleteMatch && method === 'DELETE') {
    const id = soundDeleteMatch[1];
    try {
      await deleteSound(id, userId, false);
      return json({ success: true });
    } catch (e) {
      const msg = (e as Error).message;
      const status = msg.startsWith('Forbidden') ? 403 : msg.includes('not found') ? 404 : 400;
      return error(msg, status);
    }
  }

  // -------------------------------------------------------------------------
  // Attachments
  // -------------------------------------------------------------------------
  if (reqPath === '/api/attachments' && method === 'POST') {
    try {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return error('Missing or invalid field: file');
      }
      const pending = await createPendingAttachment(file, userId);
      return json(pending, 201);
    } catch (e) {
      return error((e as Error).message);
    }
  }

  // -------------------------------------------------------------------------
  // Giphy
  // -------------------------------------------------------------------------
  if (reqPath === '/api/giphy/search' && method === 'GET') {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') ?? '';
    const limit = parseInt(url.searchParams.get('limit') ?? '25', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    if (!q.trim()) {
      return error('Missing query parameter: q');
    }
    try {
      const result = await searchGifs(q, limit, offset);
      return json(result);
    } catch (e) {
      return error((e as Error).message, 502);
    }
  }

  if (reqPath === '/api/giphy/trending' && method === 'GET') {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '25', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    try {
      const result = await getTrendingGifs(limit, offset);
      return json(result);
    } catch (e) {
      return error((e as Error).message, 502);
    }
  }

  if (reqPath === '/api/giphy/favorites') {
    if (method === 'GET') {
      const favorites = await getFavoriteGifs(userId);
      return json(favorites);
    }

    if (method === 'POST') {
      try {
        const gif = (await req.json()) as GiphyGif;
        if (!gif?.id) {
          return error('Invalid GIF data');
        }
        const favorite = await addFavoriteGif(userId, gif);
        return json(favorite, 201);
      } catch (e) {
        return error((e as Error).message);
      }
    }
  }

  const favDeleteMatch = reqPath.match(/^\/api\/giphy\/favorites\/([^/]+)$/);
  if (favDeleteMatch && method === 'DELETE') {
    const giphyId = favDeleteMatch[1];
    await removeFavoriteGif(userId, giphyId);
    return json({ success: true });
  }

  return null;
}
