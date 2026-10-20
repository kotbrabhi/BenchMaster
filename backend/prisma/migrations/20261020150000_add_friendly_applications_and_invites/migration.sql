CREATE TYPE "FriendlyApplicationStatus" AS ENUM ('INTERESTED', 'COLLECTING', 'WITHDRAWN', 'EXPIRED');
CREATE TYPE "FriendlyAvailability" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

CREATE TABLE "FriendlyMatchApplication" (
    "id" SERIAL NOT NULL,
    "proposalId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "coachUserId" INTEGER NOT NULL,
    "status" "FriendlyApplicationStatus" NOT NULL DEFAULT 'INTERESTED',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "FriendlyMatchApplication_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FriendlyMatchApplication_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "FriendlyMatchProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FriendlyMatchApplication_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FriendlyMatchApplication_coachUserId_fkey" FOREIGN KEY ("coachUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FriendlyMatchApplication_proposalId_teamId_key" ON "FriendlyMatchApplication"("proposalId", "teamId");
CREATE INDEX "FriendlyMatchApplication_coachUserId_status_idx" ON "FriendlyMatchApplication"("coachUserId", "status");
CREATE INDEX "FriendlyMatchApplication_proposalId_status_idx" ON "FriendlyMatchApplication"("proposalId", "status");

CREATE TABLE "FriendlyPlayerResponse" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "playerId" INTEGER,
    "playerNameSnapshot" TEXT NOT NULL,
    "jerseyNumberSnapshot" TEXT NOT NULL,
    "availability" "FriendlyAvailability",
    "respondedAt" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "FriendlyPlayerResponse_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FriendlyPlayerResponse_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "FriendlyMatchApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FriendlyPlayerResponse_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FriendlyPlayerResponse_applicationId_playerId_key" ON "FriendlyPlayerResponse"("applicationId", "playerId");
CREATE INDEX "FriendlyPlayerResponse_applicationId_availability_idx" ON "FriendlyPlayerResponse"("applicationId", "availability");

CREATE TABLE "FriendlyInvite" (
    "id" SERIAL NOT NULL,
    "responseId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "lastUsedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FriendlyInvite_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FriendlyInvite_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "FriendlyPlayerResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FriendlyInvite_responseId_key" ON "FriendlyInvite"("responseId");
CREATE UNIQUE INDEX "FriendlyInvite_tokenHash_key" ON "FriendlyInvite"("tokenHash");
CREATE INDEX "FriendlyInvite_expiresAt_revokedAt_idx" ON "FriendlyInvite"("expiresAt", "revokedAt");
