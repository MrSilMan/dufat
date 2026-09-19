-- Records ("registos"): a sale or expense with a client, a payment method and
-- one or more article lines. Every existing line becomes a record of its own,
-- so nothing already filed changes meaning.

-- AlterEnum
ALTER TYPE "AcaoHistoricoRelatorio" ADD VALUE 'REGISTO_ADICIONADO';
ALTER TYPE "AcaoHistoricoRelatorio" ADD VALUE 'REGISTO_EDITADO';
ALTER TYPE "AcaoHistoricoRelatorio" ADD VALUE 'REGISTO_APAGADO';

-- CreateTable
CREATE TABLE "RegistoRelatorio" (
    "id" TEXT NOT NULL,
    "relatorioId" TEXT NOT NULL,
    "tipo" "TipoLinha" NOT NULL,
    "clienteNome" TEXT,
    "clienteNif" TEXT,
    "clienteInvgestId" TEXT,
    "facturaInvgestId" TEXT,
    "facturaCodigo" TEXT,
    "metodoPagamentoId" TEXT NOT NULL,
    "metodoPagamentoNome" TEXT NOT NULL,
    "nota" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistoRelatorio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistoRelatorio_relatorioId_createdAt_idx" ON "RegistoRelatorio"("relatorioId", "createdAt");

-- AddForeignKey
ALTER TABLE "RegistoRelatorio" ADD CONSTRAINT "RegistoRelatorio_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioDiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RegistoRelatorio" ADD CONSTRAINT "RegistoRelatorio_metodoPagamentoId_fkey" FOREIGN KEY ("metodoPagamentoId") REFERENCES "MetodoPagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: lines gain quantity, unit price, their article and their record.
ALTER TABLE "LinhaRelatorio" ADD COLUMN "registoId" TEXT;
ALTER TABLE "LinhaRelatorio" ADD COLUMN "quantidadeMil" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "LinhaRelatorio" ADD COLUMN "precoUnitarioCentimos" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "LinhaRelatorio" ADD COLUMN "artigoInvgestId" TEXT;
ALTER TABLE "LinhaRelatorio" ADD COLUMN "artigoCodigo" TEXT;
ALTER TABLE "LinhaRelatorio" ADD COLUMN "ordem" INTEGER NOT NULL DEFAULT 0;

-- Backfill: one record per existing line, carrying its type, method and times.
-- The line id is reused with a prefix, so the pairing stays readable.
INSERT INTO "RegistoRelatorio" (
    "id", "relatorioId", "tipo", "metodoPagamentoId", "metodoPagamentoNome",
    "versao", "createdAt", "updatedAt"
)
SELECT
    'reg-' || "id", "relatorioId", "tipo", "metodoPagamentoId", "metodoPagamentoNome",
    "versao", "createdAt", "updatedAt"
FROM "LinhaRelatorio";

UPDATE "LinhaRelatorio"
SET "registoId" = 'reg-' || "id",
    "precoUnitarioCentimos" = "valorCentimos";

ALTER TABLE "LinhaRelatorio" ALTER COLUMN "registoId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "LinhaRelatorio_registoId_ordem_idx" ON "LinhaRelatorio"("registoId", "ordem");

-- AddForeignKey
ALTER TABLE "LinhaRelatorio" ADD CONSTRAINT "LinhaRelatorio_registoId_fkey" FOREIGN KEY ("registoId") REFERENCES "RegistoRelatorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: history rows can point at a record as well as a line.
ALTER TABLE "RelatorioHistorico" ADD COLUMN "registoId" TEXT;
