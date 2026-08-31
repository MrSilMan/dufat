import type { Metadata } from "next";
import Link from "next/link";
import { requireGestaoRH } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { historicoPremios } from "@/lib/award/queries";
import { rotuloPeriodo } from "@/lib/award/periodo";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { IconTrophy } from "@/components/admin/icons";

export const metadata: Metadata = { title: "Histórico de prémios", robots: { index: false } };
export const dynamic = "force-dynamic";

function iniciais(nome: string) {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]!.toUpperCase())
    .join("");
}

export default async function HistoricoPremiosPage() {
  await requireGestaoRH();
  const premios = await historicoPremios();

  const mensais = premios.filter((p) => p.tipo === "MENSAL");
  const anuais = premios.filter((p) => p.tipo === "ANUAL");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Histórico de prémios"
        description="Todos os vencedores confirmados, mensais e anuais, com as pontuações com que ganharam."
        backHref="/admin/premios"
        backLabel="Ranking do mês"
      />

      {premios.length === 0 ? (
        <div className="card-admin">
          <EmptyState
            icon={<IconTrophy className="h-5 w-5" />}
            title="Ainda não há prémios confirmados"
            description="Assim que confirmar o primeiro vencedor mensal, ele aparece aqui."
          />
        </div>
      ) : (
        <>
          {anuais.length > 0 && (
            <section aria-labelledby="anuais-title" className="space-y-4">
              <h2 id="anuais-title" className="font-display text-lg font-bold text-a-text">
                Funcionário do Ano
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {anuais.map((premio) => (
                  <li key={premio.id} className="card-admin border-lumen/40 p-5">
                    <p className="text-[0.7rem] font-bold uppercase tracking-[0.24em] text-lumen-deep">
                      {premio.periodo}
                    </p>
                    <p className="mt-2 font-display text-xl font-black text-a-text">
                      {premio.vencedor?.name ?? "—"}
                    </p>
                    <p className="mt-1 text-sm text-a-muted">
                      {premio.vencedor?.cargo?.nome ?? "—"}
                    </p>
                    <p className="mt-3 font-mono text-sm tabular-nums text-a-muted">
                      Média mensal {Number(premio.pontuacaoVencedor ?? 0).toFixed(1)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="mensais-title" className="space-y-4">
            <h2 id="mensais-title" className="font-display text-lg font-bold text-a-text">
              Funcionário do Mês
            </h2>
            <div className="card-admin overflow-hidden">
              <ul className="table-rows divide-y divide-a-line">
                {mensais.map((premio) => (
                  <li key={premio.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <span
                      aria-hidden
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-dufat-bright to-dufat text-xs font-bold text-white"
                    >
                      {premio.vencedor ? iniciais(premio.vencedor.name) : "—"}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-a-text">
                        {premio.vencedor?.name ?? "Sem vencedor"}
                      </p>
                      <p className="text-xs text-a-faint">
                        {rotuloPeriodo(premio.periodo)}
                        {premio.departamento ? ` · ${premio.departamento.nome}` : ""}
                        {premio.vencedor?.cargo ? ` · ${premio.vencedor.cargo.nome}` : ""}
                      </p>
                      {premio.motivoOverride && (
                        <p className="mt-1.5 text-xs text-a-muted">
                          <span className="font-medium text-a-text">Escolha do administrador:</span>{" "}
                          {premio.motivoOverride}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums text-a-text">
                        {Number(premio.pontuacaoVencedor ?? 0).toFixed(1)}
                        <span className="text-xs font-normal text-a-faint">/100</span>
                      </p>
                      <p className="text-xs text-a-faint">
                        {premio.confirmadoEm ? formatDate(premio.confirmadoEm) : "—"}
                        {premio.confirmadoPor ? ` · ${premio.confirmadoPor.name}` : ""}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/admin/premios?periodo=${premio.periodo}&dep=${premio.escopo}`}
                        className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
                      >
                        Ranking
                      </Link>
                      {premio.vencedor && (
                        <Link
                          href={`/admin/premios/certificado/${premio.id}`}
                          className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
                        >
                          Certificado
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
