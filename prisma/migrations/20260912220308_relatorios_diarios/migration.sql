-- CreateEnum
CREATE TYPE "EstadoRelatorio" AS ENUM ('RASCUNHO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "TipoLinha" AS ENUM ('VENDA', 'DESPESA');

-- CreateEnum
CREATE TYPE "AcaoHistoricoRelatorio" AS ENUM ('LINHA_ADICIONADA', 'LINHA_EDITADA', 'LINHA_APAGADA', 'FINALIZADO', 'REABERTO');

-- CreateTable
CREATE TABLE "MetodoPagamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetodoPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatorioDiario" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dia" DATE NOT NULL,
    "estado" "EstadoRelatorio" NOT NULL DEFAULT 'RASCUNHO',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "finalizadoEm" TIMESTAMP(3),
    "finalizadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelatorioDiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LinhaRelatorio" (
    "id" TEXT NOT NULL,
    "relatorioId" TEXT NOT NULL,
    "tipo" "TipoLinha" NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorCentimos" BIGINT NOT NULL,
    "metodoPagamentoId" TEXT NOT NULL,
    "metodoPagamentoNome" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LinhaRelatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelatorioHistorico" (
    "id" TEXT NOT NULL,
    "relatorioId" TEXT NOT NULL,
    "linhaId" TEXT,
    "acao" "AcaoHistoricoRelatorio" NOT NULL,
    "antes" JSONB,
    "depois" JSONB,
    "nota" TEXT,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatorioHistorico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelatorioDiario_dia_estado_idx" ON "RelatorioDiario"("dia", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "RelatorioDiario_userId_dia_key" ON "RelatorioDiario"("userId", "dia");

-- CreateIndex
CREATE INDEX "LinhaRelatorio_relatorioId_createdAt_idx" ON "LinhaRelatorio"("relatorioId", "createdAt");

-- CreateIndex
CREATE INDEX "RelatorioHistorico_relatorioId_createdAt_idx" ON "RelatorioHistorico"("relatorioId", "createdAt");

-- AddForeignKey
ALTER TABLE "RelatorioDiario" ADD CONSTRAINT "RelatorioDiario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioDiario" ADD CONSTRAINT "RelatorioDiario_finalizadoPorId_fkey" FOREIGN KEY ("finalizadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinhaRelatorio" ADD CONSTRAINT "LinhaRelatorio_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioDiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinhaRelatorio" ADD CONSTRAINT "LinhaRelatorio_metodoPagamentoId_fkey" FOREIGN KEY ("metodoPagamentoId") REFERENCES "MetodoPagamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioHistorico" ADD CONSTRAINT "RelatorioHistorico_relatorioId_fkey" FOREIGN KEY ("relatorioId") REFERENCES "RelatorioDiario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelatorioHistorico" ADD CONSTRAINT "RelatorioHistorico_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
