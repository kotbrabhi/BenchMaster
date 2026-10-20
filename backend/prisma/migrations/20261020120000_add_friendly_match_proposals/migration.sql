CREATE TYPE "FriendlyProposalStatus" AS ENUM ('DRAFT', 'OPEN', 'IN_DISCUSSION', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'EXPIRED');

CREATE TABLE "FriendlyMatchProposal" (
    "id" SERIAL NOT NULL,
    "organizerTeamId" INTEGER NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "status" "FriendlyProposalStatus" NOT NULL DEFAULT 'OPEN',
    "category" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "durationMinutes" INTEGER,
    "area" TEXT NOT NULL,
    "venueName" TEXT,
    "format" TEXT NOT NULL,
    "requestedPlayerCount" INTEGER,
    "level" TEXT,
    "notes" TEXT,
    "responseDeadline" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "cancelledAt" TIMESTAMPTZ(3),
    CONSTRAINT "FriendlyMatchProposal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FriendlyMatchProposal_durationMinutes_check" CHECK ("durationMinutes" IS NULL OR "durationMinutes" BETWEEN 1 AND 240),
    CONSTRAINT "FriendlyMatchProposal_requestedPlayerCount_check" CHECK ("requestedPlayerCount" IS NULL OR "requestedPlayerCount" BETWEEN 1 AND 30)
);

CREATE INDEX "FriendlyMatchProposal_status_startsAt_idx" ON "FriendlyMatchProposal"("status", "startsAt");
CREATE INDEX "FriendlyMatchProposal_organizerTeamId_createdAt_idx" ON "FriendlyMatchProposal"("organizerTeamId", "createdAt");

ALTER TABLE "FriendlyMatchProposal" ADD CONSTRAINT "FriendlyMatchProposal_organizerTeamId_fkey"
FOREIGN KEY ("organizerTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FriendlyMatchProposal" ADD CONSTRAINT "FriendlyMatchProposal_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
