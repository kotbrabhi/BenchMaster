import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl?.startsWith('file:./')) {
  process.env.DATABASE_URL = `file:${path.resolve(__dirname, '..', databaseUrl.slice('file:'.length).replace(/^\.\//, ''))}`;
}

const prisma = new PrismaClient();

async function main() {
  const existingTeams = await prisma.team.count();

  if (existingTeams > 0) {
    console.log('Database already contains data. Skipping bootstrap seed.');
    return;
  }

  const team = await prisma.team.create({
    data: {
      name: 'BenchMaster Demo Team',
      players: {
        create: [
          { name: 'Maya Carter', jerseyNumber: '4', position: 'PG' },
          { name: 'Nina Brooks', jerseyNumber: '7', position: 'SG' },
          { name: 'Leah Morgan', jerseyNumber: '9', position: 'SF' },
          { name: 'Jade Turner', jerseyNumber: '11', position: 'PF' },
          { name: 'Ava Scott', jerseyNumber: '13', position: 'C' },
          { name: 'Ella Reed', jerseyNumber: '15', position: 'G' },
          { name: 'Chloe Hughes', jerseyNumber: '18', position: 'F' },
          { name: 'Sofia Ward', jerseyNumber: '21', position: 'C' }
        ]
      }
    },
    include: {
      players: true
    }
  });

  console.log(`Bootstrapped team "${team.name}" with ${team.players.length} players.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
