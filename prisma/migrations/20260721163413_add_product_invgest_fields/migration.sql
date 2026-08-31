-- AlterTable: track INVGEST billing-catalog sync on products (all nullable, additive)
ALTER TABLE "Product" ADD COLUMN "invgestItemId" TEXT,
ADD COLUMN "invgestItemCode" TEXT,
ADD COLUMN "invgestSyncedAt" TIMESTAMP(3);
