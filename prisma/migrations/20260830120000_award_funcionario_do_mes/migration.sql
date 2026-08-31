-- CreateEnum
CREATE TYPE "TipoAusencia" AS ENUM ('FERIAS', 'BAIXA', 'LICENCA', 'FORMACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "EstadoFolha" AS ENUM ('ABERTA', 'SUBMETIDA', 'FECHADA');

-- CreateEnum
CREATE TYPE "EstadoAtividade" AS ENUM ('RASCUNHO', 'SUBMETIDA', 'VALIDADA', 'EM_JUSTIFICACAO', 'JUSTIFICADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "AwardTipo" AS ENUM ('MENSAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "AwardEstado" AS ENUM ('CALCULADO', 'CONFIRMADO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'GESTOR_RH';
ALTER TYPE "Role" ADD VALUE 'COLABORADOR';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cargoId" TEXT,
ADD COLUMN     "dataAdmissao" DATE,
ADD COLUMN     "dataSaida" DATE,
ADD COLUMN     "departamentoId" TEXT,
ADD COLUMN     "diasSemana" INTEGER,
ADD COLUMN     "photoUrl" TEXT;

-- CreateTable
CREATE TABLE "Departamento" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Departamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "diasSemana" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ausencia" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" "TipoAusencia" NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "aprovada" BOOLEAN NOT NULL DEFAULT false,
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ausencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaAtividade" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "isOutro" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategoriaAtividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolhaMensal" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "estado" "EstadoFolha" NOT NULL DEFAULT 'ABERTA',
    "prazoSubmissao" TIMESTAMP(3),
    "submetidaEm" TIMESTAMP(3),
    "fechadaEm" TIMESTAMP(3),
    "fechadaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FolhaMensal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atividade" (
    "id" TEXT NOT NULL,
    "folhaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "dia" DATE NOT NULL,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3) NOT NULL,
    "minutos" INTEGER NOT NULL,
    "estado" "EstadoAtividade" NOT NULL DEFAULT 'RASCUNHO',
    "possivelInconsistencia" BOOLEAN NOT NULL DEFAULT false,
    "jaQuestionada" BOOLEAN NOT NULL DEFAULT false,
    "duplicadaDe" TEXT,
    "notaRevisao" TEXT,
    "registadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revistaEm" TIMESTAMP(3),
    "revistaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Atividade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "pesoVolume" INTEGER NOT NULL DEFAULT 30,
    "pesoHoras" INTEGER NOT NULL DEFAULT 25,
    "pesoConsistencia" INTEGER NOT NULL DEFAULT 20,
    "pesoQualidade" INTEGER NOT NULL DEFAULT 15,
    "pesoPontualidade" INTEGER NOT NULL DEFAULT 10,
    "penalRejeitada" INTEGER NOT NULL DEFAULT 5,
    "penalInconsistencia" INTEGER NOT NULL DEFAULT 3,
    "penalOutro" INTEGER NOT NULL DEFAULT 10,
    "penalAtraso" INTEGER NOT NULL DEFAULT 5,
    "tetoNormalizacaoPct" INTEGER NOT NULL DEFAULT 150,
    "limiteOutroPct" INTEGER NOT NULL DEFAULT 30,
    "minDiasAtividade" INTEGER NOT NULL DEFAULT 15,
    "maxRejeitadas" INTEGER NOT NULL DEFAULT 2,
    "minPorCargo" INTEGER NOT NULL DEFAULT 3,
    "porDepartamento" BOOLEAN NOT NULL DEFAULT false,
    "excluirVencedorAnterior" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwardSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardPeriod" (
    "id" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "tipo" "AwardTipo" NOT NULL DEFAULT 'MENSAL',
    "departamentoId" TEXT,
    "escopo" TEXT NOT NULL DEFAULT 'EMPRESA',
    "estado" "AwardEstado" NOT NULL DEFAULT 'CALCULADO',
    "vencedorId" TEXT,
    "pontuacaoVencedor" DECIMAL(5,2),
    "propostoId" TEXT,
    "motivoOverride" TEXT,
    "confirmadoPorId" TEXT,
    "confirmadoEm" TIMESTAMP(3),
    "notaConfirmacao" TEXT,
    "parametros" JSONB NOT NULL,
    "calculadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AwardPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwardScore" (
    "id" TEXT NOT NULL,
    "awardPeriodId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "posicao" INTEGER,
    "pontuacaoTotal" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "componentes" JSONB NOT NULL,
    "penalizacoes" JSONB NOT NULL,
    "elegivel" BOOLEAN NOT NULL DEFAULT true,
    "motivoInelegibilidade" TEXT,

    CONSTRAINT "AwardScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Departamento_slug_key" ON "Departamento"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_slug_key" ON "Cargo"("slug");

-- CreateIndex
CREATE INDEX "Ausencia_userId_inicio_fim_idx" ON "Ausencia"("userId", "inicio", "fim");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriaAtividade_slug_key" ON "CategoriaAtividade"("slug");

-- CreateIndex
CREATE INDEX "FolhaMensal_periodo_estado_idx" ON "FolhaMensal"("periodo", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "FolhaMensal_userId_periodo_key" ON "FolhaMensal"("userId", "periodo");

-- CreateIndex
CREATE INDEX "Atividade_folhaId_dia_idx" ON "Atividade"("folhaId", "dia");

-- CreateIndex
CREATE INDEX "Atividade_userId_dia_idx" ON "Atividade"("userId", "dia");

-- CreateIndex
CREATE INDEX "Atividade_estado_idx" ON "Atividade"("estado");

-- CreateIndex
CREATE INDEX "AwardPeriod_tipo_periodo_idx" ON "AwardPeriod"("tipo", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "AwardPeriod_periodo_tipo_escopo_key" ON "AwardPeriod"("periodo", "tipo", "escopo");

-- CreateIndex
CREATE INDEX "AwardScore_awardPeriodId_posicao_idx" ON "AwardScore"("awardPeriodId", "posicao");

-- CreateIndex
CREATE UNIQUE INDEX "AwardScore_awardPeriodId_userId_key" ON "AwardScore"("awardPeriodId", "userId");

-- CreateIndex
CREATE INDEX "User_departamentoId_idx" ON "User"("departamentoId");

-- CreateIndex
CREATE INDEX "User_cargoId_idx" ON "User"("cargoId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ausencia" ADD CONSTRAINT "Ausencia_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolhaMensal" ADD CONSTRAINT "FolhaMensal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolhaMensal" ADD CONSTRAINT "FolhaMensal_fechadaPorId_fkey" FOREIGN KEY ("fechadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_folhaId_fkey" FOREIGN KEY ("folhaId") REFERENCES "FolhaMensal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaAtividade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_revistaPorId_fkey" FOREIGN KEY ("revistaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardPeriod" ADD CONSTRAINT "AwardPeriod_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardPeriod" ADD CONSTRAINT "AwardPeriod_vencedorId_fkey" FOREIGN KEY ("vencedorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardPeriod" ADD CONSTRAINT "AwardPeriod_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardScore" ADD CONSTRAINT "AwardScore_awardPeriodId_fkey" FOREIGN KEY ("awardPeriodId") REFERENCES "AwardPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwardScore" ADD CONSTRAINT "AwardScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

