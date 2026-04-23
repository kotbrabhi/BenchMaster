ALTER TABLE "Game"
ADD COLUMN "shareToken" TEXT;

CREATE UNIQUE INDEX "Game_shareToken_key" ON "Game"("shareToken");
