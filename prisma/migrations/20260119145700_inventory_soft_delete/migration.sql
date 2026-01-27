-- Add soft delete to PharmacyInventory
ALTER TABLE "PharmacyInventory" ADD COLUMN "deletedAt" TIMESTAMP(3);

