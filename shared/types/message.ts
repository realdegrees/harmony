import type { User } from './user.ts';

export enum EmbedType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  GIF = 'GIF',
  LINK = 'LINK',
}

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  path: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emojiId: string | null;
  emojiUnicode: string | null;
  count: number;
  users: string[]; // user IDs for aggregated display
}

/** Aggregated reaction display — one entry per unique emoji. */
export interface MessageReaction {
  /** Custom emoji ID, or null if unicode emoji. */
  emojiId: string | null;
  /** Unicode emoji string, or null if custom emoji. */
  emojiUnicode: string | null;
  /** Display name or unicode representation. */
  emoji: string;
  count: number;
  /** Whether the currently authenticated user has reacted with this emoji. */
  reacted: boolean;
}

export interface Embed {
  type: EmbedType;
  url: string;
  title: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  replyToId: string | null;
  editedAt: string | null;
  createdAt: string;
  author: User;
  attachments: Attachment[];
  reactions: MessageReaction[];
  replyTo: Pick<Message, 'id' | 'content' | 'authorId' | 'author'> | null;
  embeds?: Embed[];
}

export interface SearchFilters {
  query: string;
  authorId?: string;
  channelId?: string;
  hasAttachment?: boolean;
  hasLink?: boolean;
  hasImage?: boolean;
  before?: string;
  after?: string;
}

export interface PaginatedMessages {
  messages: Message[];
  hasMore: boolean;
  cursor: string | null;
}
