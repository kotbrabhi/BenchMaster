import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  FriendlyApplicationStatus,
  FriendlyAvailability,
  FriendlyNotificationType,
  FriendlyProposalStatus,
  PrismaClient,
  TeamGender
} from '../src/generated/prisma/client.js';
import { generatePasswordSalt, hashPassword } from '../src/auth/password.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to seed friendly match demo data.');

const parsedDatabaseUrl = new URL(databaseUrl);
const isLocalDatabase = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsedDatabaseUrl.hostname);
if (!isLocalDatabase && process.env.FRIENDLY_DEMO_SEED_ALLOW_REMOTE !== 'true') {
  throw new Error('This demo seed only writes to a local database. Set FRIENDLY_DEMO_SEED_ALLOW_REMOTE=true to explicitly allow a remote database.');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });
const marker = '[BENCHMASTER-FRIENDLY-DEMO]';
const demoPassword = 'friendly-demo-2026';

const playersFor = (prefix: string) => [
  { name: `${prefix} Maya Carter`, jerseyNumber: '4', position: 'PG' },
  { name: `${prefix} Nina Brooks`, jerseyNumber: '7', position: 'SG' },
  { name: `${prefix} Leah Morgan`, jerseyNumber: '9', position: 'SF' },
  { name: `${prefix} Jade Turner`, jerseyNumber: '11', position: 'PF' },
  { name: `${prefix} Ava Scott`, jerseyNumber: '13', position: 'C' },
  { name: `${prefix} Ella Reed`, jerseyNumber: '15', position: 'G' },
  { name: `${prefix} Chloe Hughes`, jerseyNumber: '18', position: 'F' },
  { name: `${prefix} Sofia Ward`, jerseyNumber: '21', position: 'C' }
];

async function getOrCreateUser(email: string, name: string) {
  const salt = generatePasswordSalt();
  return prisma.user.upsert({
    where: { email },
    create: { email, name, passwordSalt: salt, passwordHash: hashPassword(demoPassword, salt) },
    update: { name },
    select: { id: true, email: true, name: true }
  });
}

async function getOrCreateTeam(userId: number, name: string, gender: TeamGender, prefix: string) {
  let team = await prisma.team.findFirst({ where: { userId, name }, select: { id: true } });
  if (!team) {
    team = await prisma.team.create({
      data: { userId, name, gender, players: { create: playersFor(prefix) } },
      select: { id: true }
    });
  }
  return prisma.team.findUniqueOrThrow({
    where: { id: team.id },
    select: { id: true, name: true, players: { select: { id: true, name: true, jerseyNumber: true } } }
  });
}

async function main() {
  const existing = await prisma.friendlyMatchProposal.findFirst({
    where: { notes: marker },
    select: {
      id: true,
      startsAt: true,
      responseDeadline: true,
      applications: { where: { status: FriendlyApplicationStatus.COLLECTING }, select: { id: true, team: { select: { name: true } }, teamInvite: { select: { expiresAt: true, revokedAt: true } } }, take: 1 }
    }
  });
  if (existing) {
    console.log(`Friendly demo proposal #${existing.id} already exists; existing records were not reset.`);
    const collecting = existing.applications[0];
    if (collecting && (!collecting.teamInvite || collecting.teamInvite.revokedAt || collecting.teamInvite.expiresAt <= new Date())) {
      const token = randomBytes(32).toString('base64url');
      await prisma.friendlyInvite.upsert({
        where: { applicationId: collecting.id },
        create: { applicationId: collecting.id, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: existing.responseDeadline ?? existing.startsAt },
        update: { tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: existing.responseDeadline ?? existing.startsAt, revokedAt: null, lastUsedAt: null, createdAt: new Date() }
      });
      console.log(`Team invite link for ${collecting.team.name}: /friendlies/respond/${token}`);
    } else if (collecting) {
      console.log('An active team invite already exists. Renew it from the coach view to create a new copyable link.');
    }
    console.log('To use it, sign in with the credentials printed when the data was first created.');
    return;
  }

  const organizer = await getOrCreateUser('friendly-organizer@benchmaster.test', 'Demo Organisateur');
  const candidate = await getOrCreateUser('friendly-candidate@benchmaster.test', 'Demo Coach Candidat');
  const organizerTeam = await getOrCreateTeam(organizer.id, 'Lyon Étoiles U16', TeamGender.FEMININE, 'Étoiles');
  const submittedTeam = await getOrCreateTeam(candidate.id, 'Villeurbanne Lynx U16', TeamGender.FEMININE, 'Lynx');
  const collectingTeam = await getOrCreateTeam(candidate.id, 'Bron Panthères U16', TeamGender.FEMININE, 'Panthères');

  const startsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  startsAt.setMinutes(0, 0, 0);
  const responseDeadline = new Date(startsAt.getTime() - 7 * 24 * 60 * 60 * 1000);

  const proposal = await prisma.$transaction(async (tx) => {
    const createdProposal = await tx.friendlyMatchProposal.create({
      data: {
        organizerTeamId: organizerTeam.id,
        createdByUserId: organizer.id,
        status: FriendlyProposalStatus.IN_DISCUSSION,
        category: 'U16 féminines',
        startsAt,
        durationMinutes: 90,
        area: 'Lyon et métropole',
        venueName: 'Gymnase de démonstration',
        format: '5x5',
        requestedPlayerCount: 5,
        level: 'Départemental',
        notes: marker,
        responseDeadline
      }
    });

    const submittedApplication = await tx.friendlyMatchApplication.create({
      data: {
        proposalId: createdProposal.id,
        teamId: submittedTeam.id,
        coachUserId: candidate.id,
        status: FriendlyApplicationStatus.SUBMITTED,
        submittedAt: new Date()
      }
    });
    const collectingApplication = await tx.friendlyMatchApplication.create({
      data: {
        proposalId: createdProposal.id,
        teamId: collectingTeam.id,
        coachUserId: candidate.id,
        status: FriendlyApplicationStatus.COLLECTING
      }
    });

    await tx.friendlyPlayerResponse.createMany({
      data: submittedTeam.players.map((player, index) => ({
        applicationId: submittedApplication.id,
        playerId: player.id,
        playerNameSnapshot: player.name,
        normalizedName: player.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR'),
        jerseyNumberSnapshot: player.jerseyNumber,
        availability: index < 6 ? FriendlyAvailability.AVAILABLE : FriendlyAvailability.UNAVAILABLE,
        respondedAt: new Date()
      }))
    });
    const submittedResponses = await tx.friendlyPlayerResponse.findMany({
      where: { applicationId: submittedApplication.id, availability: FriendlyAvailability.AVAILABLE },
      select: { playerId: true, playerNameSnapshot: true, jerseyNumberSnapshot: true },
      take: 6
    });
    await tx.friendlyApplicationPlayer.createMany({
      data: submittedResponses.map((response) => ({
        applicationId: submittedApplication.id,
        playerId: response.playerId,
        playerNameSnapshot: response.playerNameSnapshot,
        jerseyNumberSnapshot: response.jerseyNumberSnapshot
      }))
    });

    await tx.friendlyPlayerResponse.createMany({
      data: collectingTeam.players.map((player, index) => ({
        applicationId: collectingApplication.id,
        playerId: player.id,
        playerNameSnapshot: player.name,
        normalizedName: player.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr-FR'),
        jerseyNumberSnapshot: player.jerseyNumber,
        availability: index < 3 ? FriendlyAvailability.AVAILABLE : index < 5 ? FriendlyAvailability.UNAVAILABLE : null,
        respondedAt: index < 5 ? new Date() : null
      }))
    });
    const teamInviteToken = randomBytes(32).toString('base64url');
    await tx.friendlyInvite.create({
      data: {
        applicationId: collectingApplication.id,
        tokenHash: createHash('sha256').update(teamInviteToken).digest('hex'),
        expiresAt: responseDeadline
      }
    });
    await tx.friendlyNotification.createMany({
      data: [
        { userId: organizer.id, type: FriendlyNotificationType.INTEREST_RECEIVED, proposalId: createdProposal.id, applicationId: submittedApplication.id },
        { userId: organizer.id, type: FriendlyNotificationType.TEAM_SUBMITTED, proposalId: createdProposal.id, applicationId: submittedApplication.id },
        { userId: organizer.id, type: FriendlyNotificationType.INTEREST_RECEIVED, proposalId: createdProposal.id, applicationId: collectingApplication.id }
      ]
    });
    return { createdProposal, teamInviteToken };
  });

  console.log('Created friendly match demo data without deleting existing records.');
  console.log(`Organizer: ${organizer.email} / ${demoPassword}`);
  console.log(`Candidate: ${candidate.email} / ${demoPassword}`);
  const frenchDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris' });
  console.log(`Proposal #${proposal.createdProposal.id}: ${frenchDate.format(startsAt)} (response deadline ${frenchDate.format(responseDeadline)})`);
  console.log('The candidate account has one officially submitted team ready for accept/reject and one team collecting player availability.');
  console.log(`Team invite link: /friendlies/respond/${proposal.teamInviteToken}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
