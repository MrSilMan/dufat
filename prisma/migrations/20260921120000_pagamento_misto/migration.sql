-- Split payments ("pagamento misto"): a record can be paid part one way and
-- part another — some by transfer, the rest in cash.
--
-- How a record was paid moves out of the record and its lines into a table of
-- its own, one row per method with the amount paid that way. Every existing
-- record was paid one way, for its whole total, so it becomes exactly one row
-- carrying that method, the name it was saved under, and the sum of its lines
-- — which is what the report already said it came to. Nothing already filed
-- changes meaning, and every total by method stays what it was.

-- CreateTable
CREATE TABLE "PagamentoRegisto" (
    "id" TEXT NOT NULL,
    "registoId" TEXT NOT NULL,
    "metodoPagamentoId" TEXT NOT NULL,
    "metodoPagamentoNome" TEXT NOT NULL,
    "valorCentimos" BIGINT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PagamentoRegisto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PagamentoRegisto_registoId_ordem_idx" ON "PagamentoRegisto"("registoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "PagamentoRegisto_registoId_metodoPagamentoId_key" ON "PagamentoRegisto"("registoId", "metodoPagamentoId");

-- AddForeignKey
ALTER TABLE "PagamentoRegisto" ADD CONSTRAINT "PagamentoRegisto_registoId_fkey" FOREIGN KEY ("registoId") REFERENCES "RegistoRelatorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoRegisto" ADD CONSTRAINT "PagamentoRegisto_metodoPagamentoId_fkey" FOREIGN KEY ("metodoPagamentoId") REFERENCES "MetodoPagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- An amount paid is never negative. It can be zero only for a record paid one
-- way whose total a 100% discount brought to nothing; the action refuses a
-- zero share of a split. Prisma cannot express this, so it lives here.
ALTER TABLE "PagamentoRegisto" ADD CONSTRAINT "PagamentoRegisto_valor_check" CHECK ("valorCentimos" >= 0);

-- Backfill: one payment per existing record, for the record's whole total.
-- The record id is reused with a suffix, so the pairing stays readable.
INSERT INTO "PagamentoRegisto" (
    "id", "registoId", "metodoPagamentoId", "metodoPagamentoNome", "valorCentimos", "ordem"
)
SELECT
    r."id" || '-pag0',
    r."id",
    r."metodoPagamentoId",
    r."metodoPagamentoNome",
    COALESCE((SELECT SUM(l."valorCentimos") FROM "LinhaRelatorio" l WHERE l."registoId" = r."id"), 0),
    0
FROM "RegistoRelatorio" r;

-- DropForeignKey
ALTER TABLE "LinhaRelatorio" DROP CONSTRAINT "LinhaRelatorio_metodoPagamentoId_fkey";

-- DropForeignKey
ALTER TABLE "RegistoRelatorio" DROP CONSTRAINT "RegistoRelatorio_metodoPagamentoId_fkey";

-- AlterTable
ALTER TABLE "LinhaRelatorio" DROP COLUMN "metodoPagamentoId",
DROP COLUMN "metodoPagamentoNome";

-- AlterTable
ALTER TABLE "RegistoRelatorio" DROP COLUMN "metodoPagamentoId",
DROP COLUMN "metodoPagamentoNome";
