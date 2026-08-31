-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "cargoId" TEXT,
ADD COLUMN     "dataAdmissao" DATE,
ADD COLUMN     "departamentoId" TEXT,
ADD COLUMN     "diasSemana" INTEGER;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

