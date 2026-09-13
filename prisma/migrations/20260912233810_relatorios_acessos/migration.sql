-- AlterTable
ALTER TABLE "User" ADD COLUMN     "podeRegistarRelatorios" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "podeVerRelatorios" BOOLEAN NOT NULL DEFAULT false;
