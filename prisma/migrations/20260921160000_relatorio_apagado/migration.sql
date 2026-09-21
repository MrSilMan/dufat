-- The admin can delete a report — a day opened by mistake, or the same sales
-- filed twice — and restore it. Deleting only marks the report: its records
-- and history stay. Existing reports are all left as they are (not deleted).

-- AlterEnum
ALTER TYPE "AcaoHistoricoRelatorio" ADD VALUE 'APAGADO';
ALTER TYPE "AcaoHistoricoRelatorio" ADD VALUE 'RESTAURADO';

-- AlterTable
ALTER TABLE "RelatorioDiario" ADD COLUMN     "apagadoEm" TIMESTAMP(3),
ADD COLUMN     "apagadoPorId" TEXT,
ADD COLUMN     "motivoApagado" TEXT;

-- One report per person per day now counts only the ones not deleted, so a
-- deleted report frees its day. Every existing row has "apagadoEm" NULL, so
-- the rows the old index held unique are exactly the rows the new one does.
DROP INDEX "RelatorioDiario_userId_dia_key";

-- CreateIndex
CREATE UNIQUE INDEX "RelatorioDiario_userId_dia_key" ON "RelatorioDiario"("userId", "dia") WHERE ("apagadoEm" IS NULL);

-- AddForeignKey
ALTER TABLE "RelatorioDiario" ADD CONSTRAINT "RelatorioDiario_apagadoPorId_fkey" FOREIGN KEY ("apagadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
