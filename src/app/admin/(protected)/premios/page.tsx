import type { Metadata } from "next";
import Link from "next/link";
import { requireGestaoRH } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { ESCOPO_EMPRESA, carregarPeriodoGuardado } from "@/lib/award/compute";
import { periodosDisponiveis } from "@/lib/award/queries";
import { periodoAtual, rotuloPeriodo } from "@/lib/award/periodo";
import type { LinhaRankingView } from "@/lib/award/types";
import { reabrirPeriodo } from "@/server/actions/premios";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { DangerSubmit } from "@/components/admin/DangerSubmit";
import { IconDownload, IconTrophy } from "@/components/admin/icons";
import { Podium } from "@/components/premios/Podium";
import { RankingTable } from "@/components/premios/RankingTable";
import { ConfirmarVencedorForm } from "@/components/premios/ConfirmarVencedorForm";
import { PeriodoPicker } from "@/components/premios/PeriodoPicker";

export const metadata: Metadata = { title: "Prémios", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ periodo?: string; dep?: string }> };

export default async function RankingPage({ searchParams }: Props) {
  const session = await requireGestaoRH();
  const params = await searchParams;

  const periodo = params.periodo ?? periodoAtual();
  const escopo = params.dep || ESCOPO_EMPRESA;

  const [guardado, disponiveis] = await Promise.all([
    carregarPeriodoGuardado(periodo, "MENSAL", escopo),
    periodosDisponiveis(),
  ]);

  const podeConfirmar = session.role === "ADMIN";
  const confirmado = guardado?.period.estado === "CONFIRMADO";

  const header = (
    <PageHeader
      title="Ranking do mês"
      description={`Funcionário do Mês — ${rotuloPeriodo(periodo)}. O sistema calcula, o administrador decide.`}
      action={
        <PeriodoPicker
          periodo={periodo}
          periodosDisponiveis={disponiveis}
          confirmado={confirmado}
        />
      }
    />
  );

  if (!guardado) {
    return (
      <div className="space-y-8">
        {header}
        <div className="card-admin">
          <EmptyState
            icon={<IconTrophy className="h-5 w-5" />}
            title={`${rotuloPeriodo(periodo)} ainda não foi calculado`}
            description="Feche as folhas de atividade do mês e depois calcule o ranking. Nada fica visível para os colaboradores até confirmar o vencedor."
            action={
              <Link href="/admin/folhas" className="btn-admin-ghost">
                Ver folhas de atividade
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const { period, elegiveis, naoElegiveis, parametros } = guardado;
  const linhas = elegiveis as LinhaRankingView[];

  return (
    <div className="space-y-8">
      {header}

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            confirmado ? "badge-success" : "badge-warm"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          {confirmado ? "Confirmado" : "Calculado — por confirmar"}
        </span>
        <p className="text-xs text-a-faint">
          Calculado em {formatDate(period.calculadoEm)} · {elegiveis.length} elegíveis ·{" "}
          {naoElegiveis.length} não elegíveis
          {period.departamento ? ` · ${period.departamento.nome}` : " · Toda a empresa"}
        </p>

        <div className="ml-auto flex flex-wrap gap-2">
          <Link href="/admin/premios/historico" className="btn-admin-ghost">
            Histórico
          </Link>
          <a
            href={`/admin/premios/exportar?periodo=${periodo}&escopo=${escopo}`}
            className="btn-admin-ghost inline-flex items-center gap-2"
          >
            <IconDownload className="h-4 w-4" />
            Excel (CSV)
          </a>
          <Link
            href={`/admin/premios/imprimir?periodo=${periodo}&escopo=${escopo}`}
            className="btn-admin-ghost inline-flex items-center gap-2"
          >
            <IconDownload className="h-4 w-4" />
            PDF
          </Link>
          {confirmado && period.vencedorId && (
            <Link href={`/admin/premios/certificado/${period.id}`} className="btn-admin">
              Certificado
            </Link>
          )}
        </div>
      </div>

      {confirmado && (
        <section className="card-admin border-lumen/40 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.24em] text-lumen-deep">
                Vencedor confirmado
              </p>
              <p className="mt-1 font-display text-2xl font-black text-a-text">
                {period.vencedor?.name}
              </p>
              <p className="mt-1 text-sm text-a-muted">
                {Number(period.pontuacaoVencedor ?? 0).toFixed(1)} pontos · confirmado por{" "}
                {period.confirmadoPor?.name} em{" "}
                {period.confirmadoEm ? formatDate(period.confirmadoEm) : "—"}
              </p>
              {period.motivoOverride && (
                <p className="mt-3 max-w-2xl rounded-xl border border-a-line bg-a-inset p-3 text-sm text-a-muted">
                  <span className="font-semibold text-a-text">
                    Escolha diferente da proposta do sistema:
                  </span>{" "}
                  {period.motivoOverride}
                </p>
              )}
              {period.notaConfirmacao && (
                <p className="mt-2 max-w-2xl text-sm text-a-muted">{period.notaConfirmacao}</p>
              )}
            </div>
            {podeConfirmar && (
              <form action={reabrirPeriodo}>
                <input type="hidden" name="awardPeriodId" value={period.id} />
                <DangerSubmit
                  confirmMessage={`Reabrir ${rotuloPeriodo(periodo)}? A confirmação é anulada e as pontuações deixam de estar visíveis para os colaboradores.`}
                  className="btn-row-danger"
                >
                  Reabrir período
                </DangerSubmit>
              </form>
            )}
          </div>
        </section>
      )}

      {linhas.length > 0 ? (
        <>
          <section aria-labelledby="podio-title" className="space-y-4">
            <h2 id="podio-title" className="font-display text-lg font-bold text-a-text">
              Pódio
            </h2>
            <Podium
              linhas={linhas}
              vencedorId={period.vencedorId}
              hrefBase="/admin/premios/score"
            />
          </section>

          {!confirmado && podeConfirmar && (
            <ConfirmarVencedorForm
              awardPeriodId={period.id}
              periodo={rotuloPeriodo(periodo)}
              elegiveis={linhas}
              propostoId={period.propostoId}
            />
          )}

          {!confirmado && !podeConfirmar && (
            <p className="card-admin p-4 text-sm text-a-muted">
              O ranking está calculado. A confirmação do vencedor cabe ao Administrador.
            </p>
          )}

          <section aria-labelledby="tabela-title" className="space-y-4">
            <h2 id="tabela-title" className="font-display text-lg font-bold text-a-text">
              Classificação completa
            </h2>
            <RankingTable
              linhas={linhas}
              hrefBase="/admin/premios/score"
              vencedorId={period.vencedorId}
            />
          </section>
        </>
      ) : (
        <div className="card-admin">
          <EmptyState
            title="Ninguém ficou elegível neste mês"
            description="Todos os colaboradores foram excluídos pelas regras de elegibilidade. A lista abaixo explica porquê."
          />
        </div>
      )}

      {naoElegiveis.length > 0 && (
        <section aria-labelledby="inelegiveis-title" className="space-y-4">
          <h2 id="inelegiveis-title" className="font-display text-lg font-bold text-a-text">
            Não elegíveis
            <span className="ml-2 text-sm font-normal text-a-faint">
              ({naoElegiveis.length})
            </span>
          </h2>
          <div className="card-admin overflow-hidden">
            <ul className="table-rows divide-y divide-a-line">
              {naoElegiveis.map((linha) => (
                <li
                  key={linha.userId}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-a-text">{linha.nome}</p>
                    <p className="text-xs text-a-faint">
                      {linha.cargoNome ?? "Sem cargo"} ·{" "}
                      {linha.departamentoNome ?? "Sem departamento"}
                    </p>
                  </div>
                  <p className="max-w-lg flex-1 text-sm text-a-muted">
                    {linha.motivoInelegibilidade}
                  </p>
                  <Link
                    href={`/admin/premios/score/${linha.awardScoreId}`}
                    className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
                  >
                    Detalhe
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <p className="text-xs text-a-faint">
        Pesos aplicados neste período: volume {parametros.pesoVolume}%, horas{" "}
        {parametros.pesoHoras}%, consistência {parametros.pesoConsistencia}%, qualidade{" "}
        {parametros.pesoQualidade}%, pontualidade {parametros.pesoPontualidade}%. Teto de
        normalização {parametros.tetoNormalizacaoPct}% da mediana do cargo.{" "}
        {session.role === "ADMIN" && (
          <Link href="/admin/premios/definicoes" className="text-a-accent hover:underline">
            Alterar parâmetros
          </Link>
        )}
      </p>
    </div>
  );
}
