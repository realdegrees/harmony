export enum PermissionTargetType {
  ROLE = 'ROLE',
  USER = 'USER',
}

export interface Role {
  id: string;
  name: string;
  color: string | null;
  position: number;
  /** Note: bigint requires serialization handling for JSON transport (use string). */
  permissions: bigint;
  isDefault: boolean;
}

export interface ChannelPermissionOverride {
  id: string;
  channelId: string;
  targetType: PermissionTargetType;
  targetId: string;
  allow: bigint;
  deny: bigint;
}
