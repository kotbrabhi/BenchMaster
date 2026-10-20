CREATE TYPE "FriendlyMatchLifecycle" AS ENUM ('CONFIRMED', 'CANCELLED');
CREATE TYPE "FriendlyNotificationType" AS ENUM ('INTEREST_RECEIVED', 'TEAM_SUBMITTED', 'MATCH_CONFIRMED', 'APPLICATION_REJECTED', 'MATCH_CANCELLED');

CREATE TABLE "FriendlyConfirmedMatch" (
    "id" SERIAL NOT NULL,
    "proposalId" INTEGER NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "organizerTeamId" INTEGER NOT NULL,
    "candidateTeamId" INTEGER NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "durationMinutes" INTEGER,
    "area" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" "FriendlyMatchLifecycle" NOT NULL DEFAULT 'CONFIRMED',
    "confirmedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMPTZ(3),
    "cancelledByUserId" INTEGER,
    "cancellationReason" TEXT,
    CONSTRAINT "FriendlyConfirmedMatch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FriendlyConfirmedMatch_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "FriendlyMatchProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FriendlyConfirmedMatch_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "FriendlyMatchApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FriendlyConfirmedMatch_organizerTeamId_fkey" FOREIGN KEY ("organizerTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FriendlyConfirmedMatch_candidateTeamId_fkey" FOREIGN KEY ("candidateTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FriendlyConfirmedMatch_proposalId_key" ON "FriendlyConfirmedMatch"("proposalId");
CREATE UNIQUE INDEX "FriendlyConfirmedMatch_applicationId_key" ON "FriendlyConfirmedMatch"("applicationId");
CREATE INDEX "FriendlyConfirmedMatch_organizerTeamId_startsAt_idx" ON "FriendlyConfirmedMatch"("organizerTeamId", "startsAt");
CREATE INDEX "FriendlyConfirmedMatch_candidateTeamId_startsAt_idx" ON "FriendlyConfirmedMatch"("candidateTeamId", "startsAt");
CREATE INDEX "FriendlyConfirmedMatch_status_startsAt_idx" ON "FriendlyConfirmedMatch"("status", "startsAt");

CREATE TABLE "FriendlyNotification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "FriendlyNotificationType" NOT NULL,
    "proposalId" INTEGER,
    "applicationId" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ(3),
    CONSTRAINT "FriendlyNotification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FriendlyNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FriendlyNotification_userId_readAt_createdAt_idx" ON "FriendlyNotification"("userId", "readAt", "createdAt");
ALTER TABLE "FriendlyNotification" ADD CONSTRAINT "FriendlyNotification_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "FriendlyMatchProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FriendlyNotification" ADD CONSTRAINT "FriendlyNotification_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "FriendlyMatchApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
