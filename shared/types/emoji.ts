export enum AssetScope {
  SERVER = 'SERVER',
  USER = 'USER',
}

export interface CustomEmoji {
  id: string;
  name: string;
  path: string;
  url: string;
  uploadedById: string;
  scope: AssetScope;
  userId: string | null;
  createdAt: string;
}

export interface EmojiCategory {
  name: string;
  emojis: CustomEmoji[];
}
