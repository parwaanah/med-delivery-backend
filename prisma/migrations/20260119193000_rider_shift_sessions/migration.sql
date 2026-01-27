CREATE TABLE IF NOT EXISTS "RiderShiftSession" (
  "id" SERIAL PRIMARY KEY,
  "riderId" INTEGER NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endTime" TIMESTAMP(3),
  "durationSec" INTEGER NOT NULL DEFAULT 0,
  "activeSec" INTEGER NOT NULL DEFAULT 0,
  "idleSec" INTEGER NOT NULL DEFAULT 0,
  "lastState" TEXT NOT NULL DEFAULT 'IDLE',
  "lastStateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastHeartbeat" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedReason" TEXT,
  CONSTRAINT "RiderShiftSession_riderId_fkey"
    FOREIGN KEY ("riderId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RiderShiftSession_riderId_idx" ON "RiderShiftSession"("riderId");
CREATE INDEX IF NOT EXISTS "RiderShiftSession_endTime_idx" ON "RiderShiftSession"("endTime");

