import { PermissionTargetType } from '@harmony/shared/types';
import { hasPermission } from '@harmony/shared/constants';
import { db } from '../db/client';

/**
 * Resolves the combined permission bits for a user by ORing all their role permissions.
 */
export async function resolveUserPermissions(userId: string): Promise<bigint> {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: { role: true },
  });

  return userRoles.reduce((acc, ur) => acc | ur.role.permissions, 0n);
}

/**
 * Resolves effective permissions for a user in a specific channel.
 * Priority: user overrides > role overrides > base permissions.
 *
 * The formula mirrors Discord's permission resolution:
 *   1. Start with base role permissions.
 *   2. Apply role-level channel overrides (deny then allow).
 *   3. Apply user-level channel override (deny then allow).
 */
export async function resolveChannelPermissions(
  userId: string,
  channelId: string,
): Promise<bigint> {
  const [userRoles, overrides] = await Promise.all([
    db.userRole.findMany({ where: { userId }, include: { role: true } }),
    db.channelPermissionOverride.findMany({ where: { channelId } }),
  ]);

  const basePermissions = userRoles.reduce(
    (acc, ur) => acc | ur.role.permissions,
    0n,
  );

  // Short-circuit: administrator bypasses all channel restrictions.
  if (hasPermission(basePermissions, 1n << 17n /* ADMINISTRATOR */)) {
    return basePermissions;
  }

  const roleIds = new Set(userRoles.map((ur) => ur.roleId));

  let permissions = basePermissions;

  // Apply role-level overrides (deny first, then allow).
  for (const override of overrides) {
    if (
      override.targetType === PermissionTargetType.ROLE &&
      roleIds.has(override.targetId)
    ) {
      permissions &= ~override.deny;
      permissions |= override.allow;
    }
  }

  // Apply user-level override (deny first, then allow).
  for (const override of overrides) {
    if (
      override.targetType === PermissionTargetType.USER &&
      override.targetId === userId
    ) {
      permissions &= ~override.deny;
      permissions |= override.allow;
    }
  }

  return permissions;
}

/**
 * Convenience function: returns true if the user has the given permission.
 * Optionally scoped to a channel.
 */
export async function checkPermission(
  userId: string,
  permission: bigint,
  channelId?: string,
): Promise<boolean> {
  const permissions = channelId
    ? await resolveChannelPermissions(userId, channelId)
    : await resolveUserPermissions(userId);
  return hasPermission(permissions, permission);
}
