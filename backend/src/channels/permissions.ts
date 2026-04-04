import { db } from '../db/client';
import { Permissions, hasPermission } from '@harmony/shared/constants/permissions';
import type { ChannelPermissionOverride } from '@harmony/shared/types';
import { PermissionTargetType } from '@harmony/shared/types';

// ---------------------------------------------------------------------------
// Internal DB row types (mirrors Prisma schema, avoids dependency on generated client)
// ---------------------------------------------------------------------------

interface DbUserRole {
  userId: string;
  roleId: string;
  role: { permissions: bigint };
}

interface DbChannelOverride {
  id: string;
  channelId: string;
  targetType: string;
  targetId: string;
  allow: bigint;
  deny: bigint;
}

// ---------------------------------------------------------------------------
// Permission resolution
// ---------------------------------------------------------------------------

/**
 * Compute the effective permissions for a user in a specific channel.
 *
 * Resolution order:
 *  1. ADMINISTRATOR bit → all permissions granted
 *  2. Accumulate base permissions from all roles the user holds
 *  3. Apply role-level channel overrides (deny first, then allow)
 *  4. Apply user-specific channel override (deny first, then allow)
 */
async function resolveChannelPermissions(
  userId: string,
  channelId: string,
): Promise<bigint> {
  const userRoles = (await db.userRole.findMany({
    where: { userId },
    include: { role: { select: { permissions: true } } },
  })) as DbUserRole[];

  let basePerms = 0n;
  for (const ur of userRoles) {
    basePerms |= ur.role.permissions;
  }

  // ADMINISTRATOR shortcut
  if ((basePerms & Permissions.ADMINISTRATOR) !== 0n) {
    // Return a large value representing all permissions
    return (1n << 64n) - 1n;
  }

  const overrides = (await db.channelPermissionOverride.findMany({
    where: { channelId },
  })) as DbChannelOverride[];

  const roleIds = new Set(userRoles.map((ur) => ur.roleId));

  // Apply role overrides
  let roleAllow = 0n;
  let roleDeny = 0n;
  for (const override of overrides) {
    if (override.targetType === 'ROLE' && roleIds.has(override.targetId)) {
      roleDeny |= override.deny;
      roleAllow |= override.allow;
    }
  }

  let effectivePerms = (basePerms & ~roleDeny) | roleAllow;

  // Apply user-specific override (highest priority)
  const userOverride = overrides.find(
    (o) => o.targetType === 'USER' && o.targetId === userId,
  );
  if (userOverride) {
    effectivePerms = (effectivePerms & ~userOverride.deny) | userOverride.allow;
  }

  return effectivePerms;
}

// ---------------------------------------------------------------------------
// Public permission checks
// ---------------------------------------------------------------------------

export async function canViewChannel(
  userId: string,
  channelId: string,
): Promise<boolean> {
  const perms = await resolveChannelPermissions(userId, channelId);
  return hasPermission(perms, Permissions.VIEW_CHANNELS);
}

export async function canSendMessages(
  userId: string,
  channelId: string,
): Promise<boolean> {
  const perms = await resolveChannelPermissions(userId, channelId);
  return (
    hasPermission(perms, Permissions.VIEW_CHANNELS) &&
    hasPermission(perms, Permissions.SEND_MESSAGES)
  );
}

/**
 * Global MANAGE_CHANNELS check — does not depend on a specific channel,
 * just checks the user's role permissions.
 */
export async function canManageChannel(userId: string): Promise<boolean> {
  const userRoles = (await db.userRole.findMany({
    where: { userId },
    include: { role: { select: { permissions: true } } },
  })) as DbUserRole[];

  let basePerms = 0n;
  for (const ur of userRoles) {
    basePerms |= ur.role.permissions;
  }

  return hasPermission(basePerms, Permissions.MANAGE_CHANNELS);
}

// ---------------------------------------------------------------------------
// Override management
// ---------------------------------------------------------------------------

export async function setChannelPermissionOverride(
  channelId: string,
  targetType: 'ROLE' | 'USER',
  targetId: string,
  allow: bigint,
  deny: bigint,
): Promise<void> {
  await db.channelPermissionOverride.upsert({
    where: {
      channelId_targetType_targetId: { channelId, targetType: targetType as any, targetId },
    },
    create: { channelId, targetType: targetType as any, targetId, allow, deny },
    update: { allow, deny },
  });
}

export async function removeChannelPermissionOverride(
  channelId: string,
  targetType: 'ROLE' | 'USER',
  targetId: string,
): Promise<void> {
  await db.channelPermissionOverride.deleteMany({
    where: { channelId, targetType: targetType as any, targetId },
  });
}

export async function getChannelOverrides(
  channelId: string,
): Promise<ChannelPermissionOverride[]> {
  const rows = (await db.channelPermissionOverride.findMany({
    where: { channelId },
  })) as DbChannelOverride[];

  return rows.map((r) => ({
    id: r.id,
    channelId: r.channelId,
    targetType: r.targetType as PermissionTargetType,
    targetId: r.targetId,
    allow: r.allow,
    deny: r.deny,
  }));
}
