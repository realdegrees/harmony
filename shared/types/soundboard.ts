import type { AssetScope } from './emoji.ts';

export interface SoundClip {
  id: string;
  name: string;
  path: string;
  url: string;
  uploadedById: string;
  scope: AssetScope;
  userId: string | null;
  /** Duration in seconds. */
  duration: number;
  createdAt: string;
}
