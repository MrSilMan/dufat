import type { Metadata } from "next";
import { requireGestaoRH } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { formatDate } from "@/lib/format";
import { ESCOPO_EMPRESA, carregarPeriodoGuardado } from "@/lib/award/compute";
import { rotuloPeriodo } from "@/lib/award/periodo";
import { totalPenalizacoes } from "@/lib/award/types";
import { BotaoImprimir } from "@/components/premios/BotaoImprimir";

export const metadata: Metadata = { title: "Ranking — impressão", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The ranking laid out for A4.
 *
 * A separate document rather than print rules bolted onto the interactive
 * table: sort controls, badges and detail links are all meaningless on paper,
 * and the printed version needs the parameters and the confirmation trail that
 * the screen keeps tucked away.
 */
export default async function ImprimirRankingPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; escopo?: string }>;
}) {
  await requireGestaoRH();
  const params = await searchParams;
  const periodo = params.periodo ?? "";
  const escopo = params.escopo || ESCOPO_EMPRESA;

  const [guardado, settings] = await Promise.all([
    carregarPeriodoGuardado(periodo, "MENSAL", escopo),
    getSiteSettings(),
  ]);

  if (!guardado) {
    return (
      <main className="mx-auto max-w-lg p-10 text-center">
        <h1 className="font-display text-xl font-bold text-ink">Período não calculado</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Não existe ranking guardado para {rotuloPeriodo(periodo)}.
        </p>
      </main>
    );
  }

  const { period, elegiveis, naoElegiveis, parametros } = guardado;

  return (
    <>
      <div className="no-print mx-auto flex max-w-[210mm] items-center justify-between gap-4 px-6 py-4">
        <p className="text-sm text-ink-soft">
          Ranking de {rotuloPeriodo(periodo)} — {elegiveis.length} elegíveis
        </p>
        <BotaoImprimir label="Guardar como PDF" />
      </div>

      <main className="folha-a4">
        <header className="mb-6 flex items-end justify-between gap-6 border-b-2 border-dufat pb-4">
          <div>
            <p className="text-[7pt] font-bold uppercase tracking-[0.28em] text-lumen-deep">
              {settings.footerTagline ?? "DUFAT, Lda."}
            </p>
            <h1 className="mt-1 font-display text-[20pt] font-black leading-tight text-ink">
              Funcionário do Mês
            </h1>
            <p className="mt-1 text-[10pt] text-ink-soft">
              {rotuloPeriodo(periodo)}
              {period.departamento ? ` · ${period.departamento.nome}` : " · Toda a empresa"}
            </p>
          </div>
          <div className="text-right text-[8pt] text-ink-soft">
            <p>Calculado em {formatDate(period.calculadoEm)}</p>
            <p className="mt-0.5">
              {period.estado === "CONFIRMADO"
                ? `Confirmado por ${period.confirmadoPor?.name ?? "—"}`
                : "Por confirmar"}
            </p>
          </div>
        </header>

        {period.estado === "CONFIRMADO" && period.vencedor && (
          <section className="mb-6 rounded-lg border border-lumen/50 bg-lumen/10 p-4">
            <p className="text-[7pt] font-bold uppercase tracking-[0.24em] text-lumen-deep">
              Vencedor confirmado
            </p>
            <p className="mt-1 font-display text-[16pt] font-black text-ink">
              {period.vencedor.name} — {Number(period.pontuacaoVencedor ?? 0).toFixed(1)} pontos
            </p>
            {period.motivoOverride && (
              <p className="mt-2 text-[8.5pt] leading-relaxed text-ink-soft">
                <strong>Escolha diferente da proposta do sistema:</strong> {period.motivoOverride}
              </p>
            )}
          </section>
        )}

        <table>
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Colaborador</th>
              <th>Cargo</th>
              <th className="num">Pontuação</th>
              <th className="num">Ativ.</th>
              <th className="num">Horas</th>
              <th className="num">Penal.</th>
            </tr>
          </thead>
          <tbody>
            {elegiveis.map((linha) => (
              <tr key={linha.userId}>
                <td className="num">{linha.posicao}</td>
                <td>{linha.nome}</td>
                <td>{linha.cargoNome ?? "—"}</td>
                <td className="num">{linha.pontuacaoTotal.toFixed(1)}</td>
                <td className="num">{linha.componentes.volume.bruto.toFixed(1)}</td>
                <td className="num">{linha.componentes.horas.bruto.toFixed(1)}</td>
                <td className="num">
                  {totalPenalizacoes(linha.penalizacoes) > 0
                    ? `−${totalPenalizacoes(linha.penalizacoes)}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {naoElegiveis.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-2 font-display text-[11pt] font-bold text-ink">Não elegíveis</h2>
            <table>
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Cargo</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {naoElegiveis.map((linha) => (
                  <tr key={linha.userId}>
                    <td>{linha.nome}</td>
                    <td>{linha.cargoNome ?? "—"}</td>
                    <td>{linha.motivoInelegibilidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <footer className="mt-8 border-t border-line pt-3 text-[7.5pt] leading-relaxed text-ink-faint">
          <p>
            Pesos: volume {parametros.pesoVolume}%, horas {parametros.pesoHoras}%, consistência{" "}
            {parametros.pesoConsistencia}%, qualidade {parametros.pesoQualidade}%, pontualidade{" "}
            {parametros.pesoPontualidade}%. Penalizações: −{parametros.penalRejeitada}/rejeitada,
            −{parametros.penalInconsistencia}/inconsistência questionada, −{parametros.penalOutro}{" "}
            se &quot;Outro&quot; exceder {parametros.limiteOutroPct}% das horas, −
            {parametros.penalAtraso} por entrega fora do prazo.
          </p>
          <p className="mt-1">
            Volume e horas normalizados contra a mediana do cargo, com teto em{" "}
            {parametros.tetoNormalizacaoPct}%. Mínimo de {parametros.minDiasAtividade} dias com
            registo, ajustado aos dias de trabalho esperados de cada colaborador.
          </p>
        </footer>
      </main>
    </>
  );
}
