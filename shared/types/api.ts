import type { User } from './user.ts';
import type { ChannelType } from './channel.ts';
import type { SearchFilters, PaginatedMessages } from './message.ts';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RegisterRequest {
  username: string;
  displayName: string;
  password: string;
}

export interface RegisterResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export interface CreateChannelRequest {
  name: string;
  type: ChannelType;
  topic?: string;
  categoryId?: string;
}

export interface UpdateChannelRequest {
  name?: string;
  topic?: string | null;
  position?: number;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  position?: number;
}

export interface MoveChannelToCategoryRequest {
  categoryId: string | null;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface SendMessageRequest {
  content: string;
  replyToId?: string;
}

export interface EditMessageRequest {
  content: string;
}

/** Same shape as SearchFilters — re-exported as a named API request type. */
export type SearchMessagesRequest = SearchFilters;

/** Re-export for convenience at the API boundary. */
export type SearchMessagesResponse = PaginatedMessages;

// ---------------------------------------------------------------------------
// File uploads (FormData — field documentation only)
// ---------------------------------------------------------------------------

/**
 * FormData fields:
 *   - `name`  {string}  Display name for the emoji.
 *   - `file`  {File}    Image file (PNG / GIF / WEBP).
 *   - `scope` {string}  'SERVER' | 'USER'
 */
export type UploadEmojiRequest = FormData;

/**
 * FormData fields:
 *   - `name`  {string}  Display name for the sound clip.
 *   - `file`  {File}    Audio file (MP3 / OGG / WAV).
 *   - `scope` {string}  'SERVER' | 'USER'
 */
export type UploadSoundRequest = FormData;

// ---------------------------------------------------------------------------
// Users & Roles
// ---------------------------------------------------------------------------

export interface UpdateUserRequest {
  displayName?: string;
  avatarPath?: string;
}

export interface CreateRoleRequest {
  name: string;
  color?: string;
  /** Serialized bigint string. */
  permissions?: string;
}

export interface UpdateRoleRequest {
  name?: string;
  color?: string | null;
  /** Serialized bigint string. */
  permissions?: string;
  position?: number;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Giphy
// ---------------------------------------------------------------------------

export interface GiphySearchRequest {
  query: string;
  limit?: number;
  offset?: number;
}

export interface GiphyGif {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  mp4Url?: string;
}

export interface GiphySearchResponse {
  gifs: GiphyGif[];
  next?: string;
}

export interface FavoriteGif {
  id: string;
  giphyId: string;
  url: string;
  previewUrl: string;
  createdAt: string;
}
