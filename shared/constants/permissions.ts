export const Permissions = {
  VIEW_CHANNELS:       1n << 0n,
  SEND_MESSAGES:       1n << 1n,
  EDIT_OWN_MESSAGES:   1n << 2n,
  DELETE_OWN_MESSAGES: 1n << 3n,
  DELETE_ANY_MESSAGE:  1n << 4n,
  MANAGE_CHANNELS:     1n << 5n,
  MANAGE_ROLES:        1n << 6n,
  MANAGE_EMOJIS:       1n << 7n,
  MANAGE_SOUNDBOARD:   1n << 8n,
  USE_SOUNDBOARD:      1n << 9n,
  CONNECT_VOICE:       1n << 10n,
  SPEAK:               1n << 11n,
  STREAM:              1n << 12n,
  MUTE_MEMBERS:        1n << 13n,
  DEAFEN_MEMBERS:      1n << 14n,
  KICK_MEMBERS:        1n << 15n,
  BAN_MEMBERS:         1n << 16n,
  ADMINISTRATOR:       1n << 17n,
  UPLOAD_FILES:        1n << 18n,
  MENTION_EVERYONE:    1n << 19n,
  USE_REACTIONS:       1n << 20n,
  MANAGE_MESSAGES:     1n << 21n,
} as const;

export type PermissionKey = keyof typeof Permissions;

/** Default permissions granted to all members. */
export const DEFAULT_MEMBER_PERMISSIONS: bigint =
  Permissions.VIEW_CHANNELS |
  Permissions.SEND_MESSAGES |
  Permissions.EDIT_OWN_MESSAGES |
  Permissions.DELETE_OWN_MESSAGES |
  Permissions.CONNECT_VOICE |
  Permissions.SPEAK |
  Permissions.USE_SOUNDBOARD |
  Permissions.UPLOAD_FILES |
  Permissions.USE_REACTIONS;

/** Full permission set granted to administrators. */
export const ADMIN_PERMISSIONS: bigint = Object.values(Permissions).reduce(
  (acc, p) => acc | p,
  0n,
);

/**
 * Returns true if `userPermissions` includes all bits in `required`.
 * Automatically grants all permissions when ADMINISTRATOR bit is set.
 */
export function hasPermission(userPermissions: bigint, required: bigint): boolean {
  if ((userPermissions & Permissions.ADMINISTRATOR) !== 0n) return true;
  return (userPermissions & required) === required;
}

/** Returns a new permission value with `permission` added. */
export function addPermission(current: bigint, permission: bigint): bigint {
  return current | permission;
}

/** Returns a new permission value with `permission` removed. */
export function removePermission(current: bigint, permission: bigint): bigint {
  return current & ~permission;
}

/** Serializes a bigint permission value to a decimal string for JSON transport. */
export function serializePermissions(permissions: bigint): string {
  return permissions.toString();
}

/** Deserializes a decimal string back to a bigint permission value. */
export function deserializePermissions(permissions: string): bigint {
  return BigInt(permissions);
}
