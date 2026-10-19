CREATE TABLE "SharedGameSnapshot" (
    "id" SERIAL NOT NULL,
    "shareId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedGameSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SharedGameSnapshot_shareId_key" ON "SharedGameSnapshot"("shareId");
