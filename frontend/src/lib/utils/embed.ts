import { EmbedType } from '@harmony/shared/types/message';
import type { Embed } from '@harmony/shared/types/message';

// URL regex — matches http(s) URLs
const URL_RE = /https?:\/\/[^\s<>"']+/gi;

// Image extension regex
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)(\?[^\s]*)?$/i;

// Video extension regex
const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov|mkv|avi|flv)(\?[^\s]*)?$/i;

// GIF domains / URLs
const GIF_DOMAIN_RE = /^https?:\/\/(media\.giphy\.com|giphy\.com|i\.giphy\.com|tenor\.com|c\.tenor\.com|media\.tenor\.com)/i;
const GIPHY_URL_RE = /giphy\.com\/gifs\/[^/\s]+/i;
const TENOR_URL_RE = /tenor\.com\/view\//i;

/**
 * Detects embedded content (images, GIFs, videos, links) in a message string.
 * Returns an array of Embed objects.
 */
export function detectEmbeds(content: string): Embed[] {
  const embeds: Embed[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  // Reset lastIndex in case regex is reused
  URL_RE.lastIndex = 0;

  while ((match = URL_RE.exec(content)) !== null) {
    const url = match[0].replace(/[.,;!?)]+$/, ''); // strip trailing punctuation
    if (seen.has(url)) continue;
    seen.add(url);

    const embed = classifyUrl(url);
    if (embed) embeds.push(embed);
  }

  return embeds;
}

function classifyUrl(url: string): Embed | null {
  // GIF check (before image check so Giphy/Tenor GIFs are typed as GIF)
  if (isGifUrl(url)) {
    return {
      type: EmbedType.GIF,
      url,
      title: null,
      description: null,
      thumbnailUrl: url,
      width: null,
      height: null,
    };
  }

  // Image check
  if (IMAGE_EXT_RE.test(url)) {
    return {
      type: EmbedType.IMAGE,
      url,
      title: null,
      description: null,
      thumbnailUrl: url,
      width: null,
      height: null,
    };
  }

  // Video check
  if (VIDEO_EXT_RE.test(url)) {
    return {
      type: EmbedType.VIDEO,
      url,
      title: null,
      description: null,
      thumbnailUrl: null,
      width: null,
      height: null,
    };
  }

  // YouTube embed
  if (isYouTubeUrl(url)) {
    const videoId = extractYouTubeId(url);
    return {
      type: EmbedType.VIDEO,
      url,
      title: null,
      description: null,
      thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null,
      width: 560,
      height: 315,
    };
  }

  // Generic link
  return {
    type: EmbedType.LINK,
    url,
    title: null,
    description: null,
    thumbnailUrl: null,
    width: null,
    height: null,
  };
}

function isGifUrl(url: string): boolean {
  // Giphy CDN or giphy.com/gifs/
  if (GIF_DOMAIN_RE.test(url)) return true;
  if (GIPHY_URL_RE.test(url)) return true;
  if (TENOR_URL_RE.test(url)) return true;
  // Direct .gif extension
  if (/\.gif(\?[^\s]*)?$/i.test(url)) return true;
  return false;
}

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/watch|youtu\.be\/)/i.test(url);
}

function extractYouTubeId(url: string): string | null {
  // youtu.be/<id>
  let m = url.match(/youtu\.be\/([^?&\s]+)/);
  if (m) return m[1];
  // youtube.com/watch?v=<id>
  m = url.match(/[?&]v=([^&\s]+)/);
  return m ? m[1] : null;
}

/**
 * Returns true if the URL points to an image (inline render).
 */
export function isImageUrl(url: string): boolean {
  return IMAGE_EXT_RE.test(url);
}

/**
 * Returns true if the URL is a GIF.
 */
export function isGif(url: string): boolean {
  return isGifUrl(url);
}

/**
 * Returns true if the URL points to a video file.
 */
export function isVideoUrl(url: string): boolean {
  return VIDEO_EXT_RE.test(url);
}
