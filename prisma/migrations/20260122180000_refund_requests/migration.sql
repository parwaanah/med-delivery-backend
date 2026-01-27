-- Refund requests (customer-initiated, admin-approved)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RefundRequestStatus') THEN
    CREATE TYPE "RefundRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "RefundRequest" (
  "id" SERIAL PRIMARY KEY,
  "orderId" INTEGER NOT NULL,
  "transactionId" TEXT NOT NULL,
  "requestedById" INTEGER NOT NULL,
  "status" "RefundRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAmount" NUMERIC(12,2),
  "approvedAmount" NUMERIC(12,2),
  "reason" TEXT,
  "adminNote" TEXT,
  "approvedById" INTEGER,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RefundRequest_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RefundRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RefundRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RefundRequest_orderId_createdAt_idx" ON "RefundRequest" ("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "RefundRequest_requestedById_createdAt_idx" ON "RefundRequest" ("requestedById", "createdAt");
CREATE INDEX IF NOT EXISTS "RefundRequest_status_createdAt_idx" ON "RefundRequest" ("status", "createdAt");

-- Only one pending request per order (idempotency / sanity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'RefundRequest_one_pending_per_order_idx'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX "RefundRequest_one_pending_per_order_idx" ON "RefundRequest" ("orderId") WHERE "status" = ''PENDING''';
  END IF;
END
$$;

