import "server-only";
import { prisma } from "@/lib/db";
import { PARAMETROS_PADRAO, type AwardParametros } from "@/lib/award/types";

/**
 * The award parameters in force right now.
 *
 * Falls back to the code defaults when the singleton row has never been
 * written, so the ranking works on a fresh install without anyone visiting the
 * settings screen first.
 */
export async function getAwardParametros(): Promise<AwardParametros> {
  const row = await prisma.awardSettings.findUnique({ where: { id: "singleton" } });
  if (!row) return { ...PARAMETROS_PADRAO };
  return {
    pesoVolume: row.pesoVolume,
    pesoHoras: row.pesoHoras,
    pesoConsistencia: row.pesoConsistencia,
    pesoQualidade: row.pesoQualidade,
    pesoPontualidade: row.pesoPontualidade,
    penalRejeitada: row.penalRejeitada,
    penalInconsistencia: row.penalInconsistencia,
    penalOutro: row.penalOutro,
    penalAtraso: row.penalAtraso,
    tetoNormalizacaoPct: row.tetoNormalizacaoPct,
    limiteOutroPct: row.limiteOutroPct,
    minDiasAtividade: row.minDiasAtividade,
    maxRejeitadas: row.maxRejeitadas,
    minPorCargo: row.minPorCargo,
    porDepartamento: row.porDepartamento,
    excluirVencedorAnterior: row.excluirVencedorAnterior,
  };
}

/** The five component weights have to add up to 100 or the 0–100 scale lies. */
export function somaPesos(p: Pick<
  AwardParametros,
  "pesoVolume" | "pesoHoras" | "pesoConsistencia" | "pesoQualidade" | "pesoPontualidade"
>): number {
  return (
    p.pesoVolume + p.pesoHoras + p.pesoConsistencia + p.pesoQualidade + p.pesoPontualidade
  );
}
