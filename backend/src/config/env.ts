import { z } from 'zod';

const envSchema = z.object({
  // Database (SQLite file path, e.g. file:/data/harmony.db)
  DATABASE_URL: z.string().default('file:/data/harmony.db'),

  // Auth
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  // Storage
  STORAGE_PATH: z.string().default('/data/uploads'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(50),
  MAX_EMOJI_SIZE_KB: z.coerce.number().default(256),
  MAX_SOUND_SIZE_MB: z.coerce.number().default(5),
  MAX_SOUND_DURATION_SECONDS: z.coerce.number().default(30),
  MAX_ATTACHMENT_SIZE_MB: z.coerce.number().default(25),

  // Messages
  DEFAULT_MESSAGE_LOAD_COUNT: z.coerce.number().default(100),
  MAX_MESSAGE_LENGTH: z.coerce.number().default(4000),

  // Rate Limiting
  RATE_LIMIT_MESSAGES_PER_MINUTE: z.coerce.number().default(30),
  RATE_LIMIT_UPLOADS_PER_MINUTE: z.coerce.number().default(10),

  // Giphy
  GIPHY_API_KEY: z.string().default(''),

  // Voice / mediasoup
  MEDIASOUP_LISTEN_IP: z.string().default('0.0.0.0'),
  MEDIASOUP_ANNOUNCED_IP: z.string().default('127.0.0.1'),
  MEDIASOUP_RTC_MIN_PORT: z.coerce.number().default(40000),
  MEDIASOUP_RTC_MAX_PORT: z.coerce.number().default(40100),
  MEDIA_SERVER_URL: z.string().default('http://localhost:3001'),
  MEDIA_PORT: z.coerce.number().default(3001),

  // Push Notifications
  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:admin@localhost'),

  // App
  APP_NAME: z.string().default('Harmony'),
  APP_URL: z.string().default('http://localhost'),
  PORT: z.coerce.number().default(3000),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();
