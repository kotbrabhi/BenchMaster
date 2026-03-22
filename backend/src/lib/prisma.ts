import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl?.startsWith('file:./')) {
  process.env.DATABASE_URL = `file:${path.resolve(__dirname, '../../', databaseUrl.slice('file:'.length).replace(/^\.\//, ''))}`;
}

export const prisma = new PrismaClient();
