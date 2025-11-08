-- CreateTable
CREATE TABLE "SurgeEvent" (
    "id" SERIAL NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SurgeEvent_pkey" PRIMARY KEY ("id")
);
