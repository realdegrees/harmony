/**
 * Application-wide limits. These mirror server-side env vars and are
 * exported for use on the client so UI validation stays in sync.
 */
export const Limits = {
  MAX_MESSAGE_LENGTH:          4000,
  DEFAULT_MESSAGE_LOAD_COUNT:  100,
  MAX_UPLOAD_SIZE_MB:          50,
  MAX_EMOJI_SIZE_KB:           256,
  MAX_SOUND_SIZE_MB:           5,
  MAX_SOUND_DURATION_SECONDS:  30,
  MAX_ATTACHMENT_SIZE_MB:      25,
  MAX_USERNAME_LENGTH:         32,
  MIN_USERNAME_LENGTH:         3,
  MAX_DISPLAY_NAME_LENGTH:     64,
  MIN_PASSWORD_LENGTH:         8,
  MAX_PASSWORD_LENGTH:         128,
  MAX_CHANNEL_NAME_LENGTH:     64,
  MAX_CHANNEL_TOPIC_LENGTH:    512,
  MAX_ROLE_NAME_LENGTH:        32,
  MAX_EMOJI_NAME_LENGTH:       32,
  MAX_SOUND_NAME_LENGTH:       64,
  EMOJI_DIMENSIONS:            128,
  MAX_REACTIONS_PER_MESSAGE:   20,
  MAX_GIF_FAVORITES:           500,
} as const;

export type LimitKey = keyof typeof Limits;
