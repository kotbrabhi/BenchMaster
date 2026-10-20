UPDATE "FriendlyInvite"
SET "revokedAt" = COALESCE("revokedAt", CURRENT_TIMESTAMP)
WHERE "applicationId" IS NULL AND "responseId" IS NOT NULL;
