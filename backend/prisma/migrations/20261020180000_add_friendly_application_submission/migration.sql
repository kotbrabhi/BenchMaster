ALTER TYPE "FriendlyApplicationStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "FriendlyApplicationStatus" ADD VALUE 'NEEDS_RECONFIRMATION';
ALTER TYPE "FriendlyApplicationStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "FriendlyApplicationStatus" ADD VALUE 'REJECTED';
ALTER TABLE "FriendlyMatchApplication" ADD COLUMN "submittedAt" TIMESTAMPTZ(3), ADD COLUMN "acceptedAt" TIMESTAMPTZ(3);
CREATE TABLE "FriendlyApplicationPlayer" (
    "id" SERIAL NOT NULL,
    "applicationId" INTEGER NOT NULL,
    "playerId" INTEGER,
    "playerNameSnapshot" TEXT NOT NULL,
    "jerseyNumberSnapshot" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FriendlyApplicationPlayer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FriendlyApplicationPlayer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "FriendlyMatchApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FriendlyApplicationPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FriendlyApplicationPlayer_applicationId_playerId_key" ON "FriendlyApplicationPlayer"("applicationId", "playerId");
CREATE INDEX "FriendlyApplicationPlayer_applicationId_idx" ON "FriendlyApplicationPlayer"("applicationId");
