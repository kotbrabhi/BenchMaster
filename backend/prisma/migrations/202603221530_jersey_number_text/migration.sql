PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Player" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "jerseyNumber" TEXT NOT NULL,
    "position" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Player" ("id", "teamId", "name", "jerseyNumber", "position", "createdAt", "updatedAt")
SELECT "id", "teamId", "name", CAST("jerseyNumber" AS TEXT), "position", "createdAt", "updatedAt"
FROM "Player";

DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
CREATE UNIQUE INDEX "Player_teamId_jerseyNumber_key" ON "Player"("teamId", "jerseyNumber");

PRAGMA foreign_keys=ON;
