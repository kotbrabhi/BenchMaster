-- CreateEnum
CREATE TYPE "RotationEventType" AS ENUM ('PERIOD_START', 'SUBSTITUTION', 'PERIOD_END', 'GAME_END');

-- CreateTable
CREATE TABLE "GameRotationEvent" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "kind" "RotationEventType" NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "clockMarkSeconds" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameRotationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GameRotationEvent_gameId_periodNumber_clockMarkSeconds_id_idx" ON "GameRotationEvent"("gameId", "periodNumber", "clockMarkSeconds", "id");

-- AddForeignKey
ALTER TABLE "GameRotationEvent" ADD CONSTRAINT "GameRotationEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
