import type { User as PrismaUser } from '../../generated/prisma/client.js';
import type { User, UserProfile } from '@harmony/shared/types';
import type { UpdateUserInput } from '@harmony/shared/validation';
import { db } from '../db/client';

/**
 * Strips the passwordHash and maps Prisma's User model to the shared User type.
 */
export function sanitizeUser(user: PrismaUser): User {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarPath: user.avatarPath,
    status: user.status as User['status'],
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const user = await db.user.findUnique({ where: { id } });
  return user ? sanitizeUser(user) : null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const user = await db.user.findUnique({ where: { username } });
  return user ? sanitizeUser(user) : null;
}

export async function updateUser(
  id: string,
  data: UpdateUserInput,
): Promise<User> {
  const user = await db.user.update({
    where: { id },
    data: {
      ...(data.displayName !== undefined
        ? { displayName: data.displayName }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  });
  return sanitizeUser(user);
}

export async function getAllUsers(): Promise<User[]> {
  const users = await db.user.findMany({ orderBy: { createdAt: 'asc' } });
  return users.map(sanitizeUser);
}

export async function getUserProfile(id: string): Promise<UserProfile | null> {
  const user = await db.user.findUnique({
    where: { id },
    include: {
      roles: {
        include: { role: true },
      },
    },
  });

  if (!user) return null;

  const roles = user.roles.map((ur) => ({
    id: ur.role.id,
    name: ur.role.name,
    color: ur.role.color,
    position: ur.role.position,
    permissions: ur.role.permissions,
    isDefault: ur.role.isDefault,
  }));

  return {
    ...sanitizeUser(user),
    roles,
  };
}
