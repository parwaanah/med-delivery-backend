-- CreateTable
CREATE TABLE "LoginAudit" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "email" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "eventType" TEXT NOT NULL,
    "role" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAudit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "LoginAudit" ADD CONSTRAINT "LoginAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
