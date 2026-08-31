import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireGestaoRH } from "@/lib/auth";
import { formatDate, formatDuracao } from "@/lib/format";
import { motivosInconsistencia } from "@/lib/award/inconsistencia";
import { rotuloPeriodo, toDia } from "@/lib/award/periodo";
import { acaoFolha } from "@/server/actions/atividades";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { DangerSubmit } from "@/components/admin/DangerSubmit";
import { IconClipboard } from "@/components/admin/icons";
import {
  EstadoAtividadeBadge,
  EstadoFolhaBadge,
} from "@/components/premios/EstadoAtividadeBadge";
import { RevisaoAtividade } from "@/components/premios/RevisaoAtividade";

export const metadata: Metadata = { title: "Folha de atividade", robots: { index: false } };
export const dynamic = "force-dynamic";

function hhmm(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

export default async function FolhaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGestaoRH();
  const { id } = await params;

  const folha = await prisma.folhaMensal.findUnique({
    where: { id },
    select: {
      id: true,
      periodo: true,
      estado: true,
      submetidaEm: true,
      prazoSubmissao: true,
      fechadaEm: true,
      fechadaPor: { select: { name: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          cargo: { select: { nome: true } },
          departamento: { select: { nome: true } },
        },
      },
      atividades: {
        orderBy: [{ dia: "asc" }, { inicioEm: "asc" }],
        select: {
          id: true,
          descricao: true,
          dia: true,
          inicioEm: true,
          fimEm: true,
          minutos: true,
          estado: true,
          notaRevisao: true,
          possivelInconsistencia: true,
          categoriaId: true,
          jaQuestionada: true,
          registadaEm: true,
          categoria: { select: { nome: true, isOutro: true } },
          revistaPor: { select: { name: true } },
        },
      },
    },
  });
  if (!folha) notFound();

  const validadas = folha.atividades.filter((a) => a.estado === "VALIDADA");
  const minutosValidados = validadas.reduce((sum, a) => sum + a.minutos, 0);
  const porRever = folha.atividades.filter(
    (a) => a.estado === "SUBMETIDA" || a.estado === "JUSTIFICADA",
  ).length;
  const emJustificacao = folha.atividades.filter((a) => a.estado === "EM_JUSTIFICACAO").length;
  const rejeitadas = folha.atividades.filter((a) => a.estado === "REJEITADA").length;

  // Group by day so a bulk-entry pattern is visible at a glance rather than
  // buried in a flat list of forty rows.
  const porDia = new Map<string, typeof folha.atividades>();
  for (const atividade of folha.atividades) {
    const dia = toDia(atividade.dia);
    const bucket = porDia.get(dia);
    if (bucket) bucket.push(atividade);
    else porDia.set(dia, [atividade]);
  }

  const atrasada =
    folha.prazoSubmissao && folha.submetidaEm && folha.submetidaEm > folha.prazoSubmissao;

  return (
    <div className="space-y-8">
      <PageHeader
        title={folha.user.name}
        description={`${folha.user.cargo?.nome ?? "Sem cargo"} · ${folha.user.departamento?.nome ?? "Sem departamento"} · ${rotuloPeriodo(folha.periodo)}`}
        backHref={`/admin/folhas?periodo=${folha.periodo}`}
        backLabel="Folhas de atividade"
        action={
          folha.estado !== "FECHADA" ? (
            <form action={acaoFolha}>
              <input type="hidden" name="folhaId" value={folha.id} />
              <input type="hidden" name="acao" value="fechar" />
              <DangerSubmit
                confirmMessage={`Fechar a folha de ${folha.user.name}? Só folhas fechadas entram no ranking.`}
                tone="primary"
                className="btn-admin"
              >
                Fechar folha
              </DangerSubmit>
            </form>
          ) : (
            <form action={acaoFolha}>
              <input type="hidden" name="folhaId" value={folha.id} />
              <input type="hidden" name="acao" value="reabrir" />
              <DangerSubmit
                confirmMessage="Reabrir esta folha? Se o prémio deste mês já foi calculado, terá de o recalcular."
                className="btn-row-danger"
              >
                Reabrir folha
              </DangerSubmit>
            </form>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { rotulo: "Estado", valor: <EstadoFolhaBadge estado={folha.estado} /> },
          {
            rotulo: "Horas validadas",
            valor: (
              <span className="font-mono text-lg font-semibold tabular-nums text-a-text">
                {formatDuracao(minutosValidados)}
              </span>
            ),
          },
          {
            rotulo: "Por rever",
            valor: (
              <span
                className={`font-mono text-lg font-semibold tabular-nums ${
                  porRever + emJustificacao > 0 ? "text-lumen-deep" : "text-a-text"
                }`}
              >
                {porRever + emJustificacao}
              </span>
            ),
          },
          {
            rotulo: "Rejeitadas",
            valor: (
              <span
                className={`font-mono text-lg font-semibold tabular-nums ${
                  rejeitadas > 0 ? "text-rose-500" : "text-a-text"
                }`}
              >
                {rejeitadas}
              </span>
            ),
          },
        ].map((cartao) => (
          <div key={cartao.rotulo} className="card-admin p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-wider text-a-faint">
              {cartao.rotulo}
            </p>
            <div className="mt-2">{cartao.valor}</div>
          </div>
        ))}
      </div>

      {(atrasada || emJustificacao > 0) && (
        <div className="card-admin border-lumen/40 p-4 text-sm text-a-muted">
          {atrasada && (
            <p>
              Folha submetida em {formatDate(folha.submetidaEm!)}, depois do prazo de{" "}
              {formatDate(folha.prazoSubmissao!)} — isto desconta pontos no cálculo.
            </p>
          )}
          {emJustificacao > 0 && (
            <p className={atrasada ? "mt-2" : undefined}>
              {emJustificacao} registo(s) ainda em justificação. Enquanto assim ficarem,{" "}
              {folha.user.name} não é elegível para o prémio deste mês.
            </p>
          )}
        </div>
      )}

      {folha.estado === "FECHADA" && folha.fechadaEm && (
        <p className="text-xs text-a-faint">
          Fechada em {formatDate(folha.fechadaEm)}
          {folha.fechadaPor ? ` por ${folha.fechadaPor.name}` : ""}.
        </p>
      )}

      {folha.atividades.length === 0 ? (
        <div className="card-admin">
          <EmptyState
            icon={<IconClipboard className="h-5 w-5" />}
            title="Folha sem registos"
            description="Este colaborador ainda não registou nada neste mês."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {[...porDia.entries()].map(([dia, atividades]) => (
            <section key={dia} aria-labelledby={`dia-${dia}`}>
              <div className="mb-2 flex items-baseline gap-3">
                <h2
                  id={`dia-${dia}`}
                  className="font-mono text-sm font-semibold text-a-text"
                >
                  {dia}
                </h2>
                <p className="text-xs text-a-faint">
                  {atividades.length} registo{atividades.length === 1 ? "" : "s"}
                  {atividades.length > 15 && " — acima do limite diário de 15"}
                </p>
              </div>

              <div className="card-admin overflow-hidden">
                <ul className="table-rows divide-y divide-a-line">
                  {atividades.map((atividade) => (
                    <li
                      key={atividade.id}
                      className="flex flex-wrap items-start gap-3 px-5 py-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-a-text">{atividade.descricao}</p>
                        <p className="mt-1 font-mono text-xs text-a-faint">
                          {hhmm(atividade.inicioEm)}–{hhmm(atividade.fimEm)} ·{" "}
                          {formatDuracao(atividade.minutos)} · {atividade.categoria.nome}
                          {atividade.categoria.isOutro && " (Outro)"} · registado{" "}
                          {toDia(atividade.registadaEm)}
                        </p>
                        {atividade.possivelInconsistencia && (
                          <ul className="mt-1.5 space-y-0.5 text-xs text-lumen-deep">
                            {motivosInconsistencia(atividade, folha.atividades).map((motivo) => (
                              <li key={motivo}>Sinalizada — {motivo.toLowerCase()}</li>
                            ))}
                          </ul>
                        )}
                        {atividade.jaQuestionada && (
                          <p className="mt-1 text-xs text-a-faint">
                            Já foi questionada anteriormente (conta na qualidade).
                          </p>
                        )}
                        {atividade.notaRevisao && (
                          <p className="mt-2 rounded-lg border border-a-line bg-a-inset p-2.5 text-xs text-a-muted">
                            <span className="font-semibold text-a-text">
                              {atividade.revistaPor?.name ?? "Revisor"}:
                            </span>{" "}
                            {atividade.notaRevisao}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <EstadoAtividadeBadge estado={atividade.estado} />
                        {folha.estado !== "FECHADA" && (
                          <RevisaoAtividade
                            atividadeId={atividade.id}
                            estado={atividade.estado}
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
