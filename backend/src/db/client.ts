import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '../../generated/prisma/client.js';
import { env } from '../config/env';

const adapter = new PrismaLibSql({ url: env.DATABASE_URL });

export const db = new PrismaClient({ adapter });
