ALTER TABLE "FriendlyPlayerResponse" ADD COLUMN IF NOT EXISTS "normalizedName" TEXT NOT NULL DEFAULT '';
UPDATE "FriendlyPlayerResponse"
SET "normalizedName" = lower(regexp_replace(trim("playerNameSnapshot"), '[[:space:]]+', ' ', 'g'));
WITH duplicates AS (
    SELECT "id", row_number() OVER (PARTITION BY "applicationId", "normalizedName" ORDER BY "id") AS ordinal
    FROM "FriendlyPlayerResponse"
)
UPDATE "FriendlyPlayerResponse" response
SET "normalizedName" = response."normalizedName" || '#legacy-' || response."id"
FROM duplicates
WHERE duplicates."id" = response."id" AND duplicates.ordinal > 1;
CREATE UNIQUE INDEX IF NOT EXISTS "FriendlyPlayerResponse_applicationId_normalizedName_key"
ON "FriendlyPlayerResponse"("applicationId", "normalizedName");

ALTER TABLE "FriendlyInvite" ALTER COLUMN "responseId" DROP NOT NULL;
ALTER TABLE "FriendlyInvite" ADD COLUMN IF NOT EXISTS "applicationId" INTEGER;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FriendlyInvite_applicationId_fkey') THEN
        ALTER TABLE "FriendlyInvite" ADD CONSTRAINT "FriendlyInvite_applicationId_fkey"
        FOREIGN KEY ("applicationId") REFERENCES "FriendlyMatchApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "FriendlyInvite_applicationId_key" ON "FriendlyInvite"("applicationId");
CREATE INDEX IF NOT EXISTS "FriendlyInvite_expiresAt_revokedAt_idx" ON "FriendlyInvite"("expiresAt", "revokedAt");

CREATE TABLE IF NOT EXISTS "FriendlyPlayerAvailabilityHistory" (
    "id" SERIAL NOT NULL,
    "responseId" INTEGER NOT NULL,
    "availability" "FriendlyAvailability" NOT NULL,
    "respondedAt" TIMESTAMPTZ(3),
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FriendlyPlayerAvailabilityHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FriendlyPlayerAvailabilityHistory_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "FriendlyPlayerResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "FriendlyPlayerAvailabilityHistory_responseId_changedAt_idx" ON "FriendlyPlayerAvailabilityHistory"("responseId", "changedAt");
INSERT INTO "FriendlyPlayerAvailabilityHistory" ("responseId", "availability", "respondedAt")
SELECT response."id", response."availability", response."respondedAt"
FROM "FriendlyPlayerResponse" response
WHERE response."availability" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "FriendlyPlayerAvailabilityHistory" history WHERE history."responseId" = response."id");
