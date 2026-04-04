import { GiphyFetch } from '@giphy/js-fetch-api';
import type { IGif } from '@giphy/js-types';
import { db } from '../db/client';
import { getRedis } from '../utils/redis';
import { env } from '../config/env';
import type { GiphyGif, GiphySearchResponse, FavoriteGif } from '@harmony/shared/types/api';

const SEARCH_CACHE_TTL = 3600;   // 1 hour
const TRENDING_CACHE_TTL = 900;  // 15 minutes

// Lazily initialised — returns a no-op stub when no API key is configured
let _gf: GiphyFetch | null = null;
function gf(): GiphyFetch {
  if (!_gf) {
    _gf = new GiphyFetch(env.GIPHY_API_KEY || 'MISSING_KEY');
  }
  return _gf;
}

// ---------------------------------------------------------------------------
// Map the SDK's IGif to our simpler GiphyGif shape
// ---------------------------------------------------------------------------
function mapGif(gif: IGif): GiphyGif {
  const original = gif.images.original;
  const preview =
    gif.images.fixed_height_downsampled?.url ??
    gif.images.downsized_medium?.url ??
    gif.images.preview_gif?.url ??
    original.url;

  return {
    id: gif.id as string,
    title: gif.title,
    url: original.url,
    previewUrl: preview as string,
    width: Number(original.width) || 0,
    height: Number(original.height) || 0,
    mp4Url: original.mp4 as string | undefined,
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export async function searchGifs(
  query: string,
  limit = 25,
  offset = 0,
): Promise<GiphySearchResponse> {
  if (!env.GIPHY_API_KEY) return { gifs: [] };

  const cacheKey = `giphy:search:${query}:${limit}:${offset}`;
  const redis = getRedis();
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as GiphySearchResponse;

  const { data } = await gf().search(query, { limit, offset, type: 'gifs' });
  const result: GiphySearchResponse = { gifs: data.map(mapGif) };

  await redis.setex(cacheKey, SEARCH_CACHE_TTL, JSON.stringify(result));
  return result;
}

// ---------------------------------------------------------------------------
// Trending
// ---------------------------------------------------------------------------
export async function getTrendingGifs(
  limit = 25,
  offset = 0,
): Promise<GiphySearchResponse> {
  if (!env.GIPHY_API_KEY) return { gifs: [] };

  const cacheKey = `giphy:trending:${limit}:${offset}`;
  const redis = getRedis();
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as GiphySearchResponse;

  const { data } = await gf().trending({ limit, offset, type: 'gifs' });
  const result: GiphySearchResponse = { gifs: data.map(mapGif) };

  await redis.setex(cacheKey, TRENDING_CACHE_TTL, JSON.stringify(result));
  return result;
}

// ---------------------------------------------------------------------------
// Single GIF by ID
// ---------------------------------------------------------------------------
export async function getGifById(id: string): Promise<GiphyGif | null> {
  if (!env.GIPHY_API_KEY) return null;

  try {
    const { data } = await gf().gif(id);
    return mapGif(data);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Favorites (DB-backed, no SDK involvement)
// ---------------------------------------------------------------------------
export async function addFavoriteGif(userId: string, gif: GiphyGif): Promise<FavoriteGif> {
  const record = await db.favoriteGif.upsert({
    where: { userId_giphyId: { userId, giphyId: gif.id } },
    create: { userId, giphyId: gif.id, url: gif.url, previewUrl: gif.previewUrl },
    update: { url: gif.url, previewUrl: gif.previewUrl },
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
