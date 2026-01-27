-- Incidents: admin incident management (enterprise ops)

CREATE TABLE IF NOT EXISTS "Incident" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'SEV3',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "description" TEXT,
  "orderId" INTEGER,
  "supportTicketId" INTEGER,
  "createdById" INTEGER,
  "assignedToId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "meta" JSONB,
  CONSTRAINT "Incident_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Incident_supportTicketId_fkey" FOREIGN KEY ("supportTicketId") REFERENCES "SupportTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Incident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Incident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Incident_status_createdAt_idx" ON "Incident"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Incident_severity_createdAt_idx" ON "Incident"("severity", "createdAt");
CREATE INDEX IF NOT EXISTS "Incident_orderId_idx" ON "Incident"("orderId");
CREATE INDEX IF NOT EXISTS "Incident_supportTicketId_idx" ON "Incident"("supportTicketId");
CREATE INDEX IF NOT EXISTS "Incident_assignedToId_idx" ON "Incident"("assignedToId");

CREATE TABLE IF NOT EXISTS "IncidentEvent" (
  "id" SERIAL PRIMARY KEY,
  "incidentId" INTEGER NOT NULL,
  "actorId" INTEGER,
  "type" TEXT NOT NULL DEFAULT 'COMMENT',
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "meta" JSONB,
  CONSTRAINT "IncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "IncidentEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "IncidentEvent_incidentId_createdAt_idx" ON "IncidentEvent"("incidentId", "createdAt");
CREATE INDEX IF NOT EXISTS "IncidentEvent_actorId_createdAt_idx" ON "IncidentEvent"("actorId", "createdAt");

