CREATE TABLE "CoachSettings" (
    "userId" INTEGER NOT NULL,
    "defaultPeriodCount" INTEGER NOT NULL DEFAULT 4,
    "defaultPeriodDurationSeconds" INTEGER NOT NULL DEFAULT 600,
    "playingTimeDisplay" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "visibleLiveStats" JSONB NOT NULL DEFAULT '["points","rebounds","assists","blocks","interceptions"]',
    "confirmSessionEnd" BOOLEAN NOT NULL DEFAULT true,
    "openSummaryAfterEnd" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "CoachSettings_pkey" PRIMARY KEY ("userId"),
    CONSTRAINT "CoachSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
