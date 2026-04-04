import type { Role as PrismaRole } from '../../generated/prisma/client.js';
import type { Role } from '@harmony/shared/types';
import type { CreateRoleInput, UpdateRoleInput } from '@harmony/shared/validation';
import {
  deserializePermissions,
  ADMIN_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
} from '@harmony/shared/constants';
import { db } from '../db/client';

/**
 * Maps a Prisma Role to the shared Role type.
 * BigInt permissions are kept as bigint — callers must serialize for JSON transport.
 */
export function sanitizeRole(role: PrismaRole): Role {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    position: role.position,
    permissions: role.permissions,
    isDefault: role.isDefault,
  };
}

export async function createRole(data: CreateRoleInput): Promise<Role> {
  const role = await db.role.create({
    data: {
      name: data.name,
      color: data.color ?? null,
      permissions: data.permissions
        ? deserializePermissions(data.permissions)
        : 0n,
    },
  });
  return sanitizeRole(role);
}

export async function updateRole(
  id: string,
  data: UpdateRoleInput,
): Promise<Role> {
  const role = await db.role.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.permissions !== undefined
        ? { permissions: deserializePermissions(data.permissions) }
        : {}),
      ...(data.position !== undefined ? { position: data.position } : {}),
    },
  });
  return sanitizeRole(role);
}

export async function deleteRole(id: string): Promise<void> {
  await db.role.delete({ where: { id } });
}

export async function getAllRoles(): Promise<Role[]> {
  const roles = await db.role.findMany({ orderBy: { position: 'asc' } });
  return roles.map(sanitizeRole);
}

export async function getRoleById(id: string): Promise<Role | null> {
  const role = await db.role.findUnique({ where: { id } });
  return role ? sanitizeRole(role) : null;
}

export async function assignRole(
  userId: string,
  roleId: string,
): Promise<void> {
  await db.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    create: { userId, roleId },
    update: {},
  });
}

export async function removeRole(
  userId: string,
  roleId: string,
): Promise<void> {
  await db.userRole.delete({
    where: { userId_roleId: { userId, roleId } },
  });
}

export async function getUserRoles(userId: string): Promise<Role[]> {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: { role: true },
    orderBy: { role: { position: 'asc' } },
  });
  return userRoles.map((ur) => sanitizeRole(ur.role));
}

export async function getDefaultRole(): Promise<Role | null> {
  const role = await db.role.findFirst({ where: { isDefault: true } });
  return role ? sanitizeRole(role) : null;
}

export async function getAdminRole(): Promise<Role | null> {
  const role = await db.role.findFirst({ where: { name: 'Admin' } });
  return role ? sanitizeRole(role) : null;
}

/**
 * Creates the Admin and Member roles if they do not already exist.
 * Intended to be called once at application startup.
 */
export async function ensureDefaultRoles(): Promise<void> {
  const [admin, member] = await Promise.all([
    db.role.findUnique({ where: { name: 'Admin' } }),
    db.role.findUnique({ where: { name: 'Member' } }),
  ]);

  if (!admin) {
    await db.role.create({
      data: {
        name: 'Admin',
        color: '#e74c3c',
        position: 0,
        permissions: ADMIN_PERMISSIONS,
        isDefault: false,
      },
    });
    console.log('[roles] Created default "Admin" role');
  }

  if (!member) {
    await db.role.create({
      data: {
        name: 'Member',
        color: null,
        position: 1,
        permissions: DEFAULT_MEMBER_PERMISSIONS,
        isDefault: true,
      },
    });
    console.log('[roles] Created default "Member" role');
  }
}
