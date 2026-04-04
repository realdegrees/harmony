import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import {
  ADMIN_PERMISSIONS,
  DEFAULT_MEMBER_PERMISSIONS,
  serializePermissions,
} from '@harmony/shared/constants';
import { env } from '../config/env';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function seed() {
  console.log('Starting database seed...');

  // -----------------------------------------------------------------------
  // Roles
  // -----------------------------------------------------------------------

  let adminRole = await db.role.findUnique({ where: { name: 'Admin' } });
  if (!adminRole) {
    adminRole = await db.role.create({
      data: {
        name: 'Admin',
        color: '#e74c3c',
        position: 0,
        permissions: ADMIN_PERMISSIONS,
        isDefault: false,
      },
    });
    console.log(
      `[seed] Created role "Admin" (permissions: ${serializePermissions(ADMIN_PERMISSIONS)})`,
    );
  } else {
    console.log('[seed] Role "Admin" already exists, skipping.');
  }

  let memberRole = await db.role.findUnique({ where: { name: 'Member' } });
  if (!memberRole) {
    memberRole = await db.role.create({
      data: {
        name: 'Member',
        color: null,
        position: 1,
        permissions: DEFAULT_MEMBER_PERMISSIONS,
        isDefault: true,
      },
    });
    console.log(
      `[seed] Created role "Member" (permissions: ${serializePermissions(DEFAULT_MEMBER_PERMISSIONS)})`,
    );
  } else {
    console.log('[seed] Role "Member" already exists, skipping.');
  }

  // -----------------------------------------------------------------------
  // Channels
  // -----------------------------------------------------------------------

  const generalText = await db.channel.findFirst({
    where: { name: 'general', type: 'TEXT' },
  });
  if (!generalText) {
    await db.channel.create({
      data: { name: 'general', type: 'TEXT', position: 0 },
    });
    console.log('[seed] Created text channel "general".');
  } else {
    console.log('[seed] Text channel "general" already exists, skipping.');
  }

  const generalVoice = await db.channel.findFirst({
    where: { name: 'General', type: 'VOICE' },
  });
  if (!generalVoice) {
    await db.channel.create({
      data: { name: 'General', type: 'VOICE', position: 0 },
    });
    console.log('[seed] Created voice channel "General".');
  } else {
    console.log('[seed] Voice channel "General" already exists, skipping.');
  }

  // -----------------------------------------------------------------------
  // Done
  // -----------------------------------------------------------------------

  console.log('Database seed complete.');
  await db.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
