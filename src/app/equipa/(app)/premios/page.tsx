import type { Metadata } from "next";
import { requireSession } from "@/lib/auth";
import { meusPremios } from "@/lib/award/queries";
import { rotuloPeriodo } from "@/lib/award/periodo";
import type { Componentes, Penalizacao } from "@/lib/award/types";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { IconTrophy } from "@/components/admin/icons";
import { ScoreBreakdown } from "@/components/premios/ScoreBreakdown";

export const metadata: Metadata = { title: "A minha pontuação", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The employee's own award history.
 *
 * Their score, their position and the confirmed winner — never the rest of the
 * table. And nothing at all until a period is confirmed: a live leaderboard
 * during the month turns the sheet into a scoreboard, and people start logging
 * for the ranking instead of logging what they actually did.
 */
export default async function MinhaPontuacaoPage() {
  const session = await requireSession("/equipa/entrar");
  const premios = await meusPremios(session.sub);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Equipa"
        title="A minha pontuação"
        description="A sua posição e a decomposição da sua pontuação em cada mês já confirmado."
      />

      {premios.length === 0 ? (
        <div className="card-admin">
          <EmptyState
            icon={<IconTrophy className="h-5 w-5" />}
            title="Ainda não há pontuações publicadas"
            description="As pontuações aparecem aqui depois de o Administrador confirmar o vencedor de cada mês. Não há classificação em tempo real durante o mês."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {premios.map((premio) => {
            const score = premio.score;
            return (
              <section
                key={premio.id}
                className={`card-admin p-6 ${premio.venceu ? "border-lumen/50" : ""}`}
                aria-labelledby={`premio-${premio.periodo}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-a-line pb-4">
                  <div>
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.24em] text-a-accent">
                      {rotuloPeriodo(premio.periodo)}
                    </p>
                    <h2
                      id={`premio-${premio.periodo}`}
                      className="mt-1 font-display text-lg font-bold text-a-text"
                    >
                      {score.elegivel
                        ? `${score.posicao}.º lugar entre ${premio.totalElegiveis} elegíveis`
                        : "Não elegível este mês"}
                    </h2>
                    {!score.elegivel && score.motivoInelegibilidade && (
                      <p className="mt-1.5 text-sm text-a-muted">
                        {score.motivoInelegibilidade}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    {premio.venceu ? (
                      <p className="rounded-full bg-lumen/15 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-lumen-deep">
                        Funcionário do Mês
                      </p>
                    ) : (
                      <>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-a-faint">
                          Vencedor
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-a-text">
                          {premio.vencedorNome ?? "—"}
                        </p>
                        <p className="text-xs text-a-faint">{premio.vencedorCargo ?? ""}</p>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <ScoreBreakdown
                    componentes={score.componentes as unknown as Componentes}
                    penalizacoes={(score.penalizacoes as unknown as Penalizacao[]) ?? []}
                    pontuacaoTotal={Number(score.pontuacaoTotal)}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="text-xs text-a-faint">
        Vê apenas a sua própria pontuação e o vencedor confirmado. As pontuações dos colegas não
        são públicas.
      </p>
    </div>
  );
}
