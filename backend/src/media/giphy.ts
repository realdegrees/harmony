import { db } from '../db/client';
import { getRedis } from '../utils/redis';
import { env } from '../config/env';
import type { GiphyGif, GiphySearchResponse, FavoriteGif } from '@harmony/shared/types/api';

const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';
const SEARCH_CACHE_TTL = 3600;    // 1 hour
const TRENDING_CACHE_TTL = 900;   // 15 minutes

interface GiphyRawGif {
  id: string;
  title: string;
  url: string;
  images: {
    original: { url: string; width: string; height: string; mp4?: string };
    fixed_height_downsampled?: { url: string };
    downsized_medium?: { url: string };
    preview_gif?: { url: string };
  };
}

function mapGif(raw: GiphyRawGif): GiphyGif {
  const original = raw.images.original;
  const preview =
    raw.images.fixed_height_downsampled?.url ??
    raw.images.downsized_medium?.url ??
    raw.images.preview_gif?.url ??
    original.url;

  return {
    id: raw.id,
    title: raw.title,
    url: original.url,
    previewUrl: preview,
    width: parseInt(original.width, 10) || 0,
    height: parseInt(original.height, 10) || 0,
    mp4Url: original.mp4,
  };
}

async function giphyFetch(endpoint: string, params: Record<string, string | number>): Promise<unknown> {
  if (!env.GIPHY_API_KEY) {
    return { data: [], pagination: {} };
  }

  const url = new URL(`${GIPHY_BASE}${endpoint}`);
  url.searchParams.set('api_key', env.GIPHY_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Giphy API error: ${res.status}`);
  }
  return res.json();
}

export async function searchGifs(
  query: string,
  limit = 25,
  offset = 0,
): Promise<GiphySearchResponse> {
  const cacheKey = `giphy:search:${query}:${limit}:${offset}`;
  const redis = getRedis();

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as GiphySearchResponse;
  }

  const data = await giphyFetch('/search', { q: query, limit, offset }) as {
    data: GiphyRawGif[];
    pagination?: { count?: number; total_count?: number; offset?: number };
  };

  const result: GiphySearchResponse = {
    gifs: (data.data ?? []).map(mapGif),
  };

  await redis.setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(result));
  return result;
}

export async function getTrendingGifs(
  limit = 25,
  offset = 0,
): Promise<GiphySearchResponse> {
  const cacheKey = `giphy:trending:${limit}:${offset}`;
  const redis = getRedis();

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as GiphySearchResponse;
  }

  const data = await giphyFetch('/trending', { limit, offset }) as {
    data: GiphyRawGif[];
  };

  const result: GiphySearchResponse = {
    gifs: (data.data ?? []).map(mapGif),
  };

  await redis.setex(cacheKey, TRENDING_CACHE_TTL, JSON.stringify(result));
  return result;
}

export async function getGifById(id: string): Promise<GiphyGif | null> {
  if (!env.GIPHY_API_KEY) return null;

  const url = new URL(`${GIPHY_BASE}/${id}`);
  url.searchParams.set('api_key', env.GIPHY_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) return null;

  const data = await res.json() as { data?: GiphyRawGif };
  if (!data.data) return null;
  return mapGif(data.data);
}

export async function addFavoriteGif(userId: string, gif: GiphyGif): Promise<FavoriteGif> {
  const record = await db.favoriteGif.upsert({
    where: { userId_giphyId: { userId, giphyId: gif.id } },
    create: {
      userId,
      giphyId: gif.id,
      url: gif.url,
      previewUrl: gif.previewUrl,
    },
    update: {
      url: gif.url,
      previewUrl: gif.previewUrl,
    },
  });

  return {
    id: record.id,
    giphyId: record.giphyId,
    url: record.url,
    previewUrl: record.previewUrl,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function removeFavoriteGif(userId: string, giphyId: string): Promise<void> {
  await db.favoriteGif.deleteMany({ where: { userId, giphyId } });
}

export async function getFavoriteGifs(userId: string): Promise<FavoriteGif[]> {
  const records = await db.favoriteGif.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  return records.map((r) => ({
    id: r.id,
    giphyId: r.giphyId,
    url: r.url,
    previewUrl: r.previewUrl,
    createdAt: r.createdAt.toISOString(),
  }));
}
