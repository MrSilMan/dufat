import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireGestaoRH } from "@/lib/auth";
import { formatDuracao } from "@/lib/format";
import { periodoAtual, rotuloPeriodo } from "@/lib/award/periodo";
import { periodosDisponiveis } from "@/lib/award/queries";
import { POR_REVER } from "@/lib/award/types";
import { acaoFolha, fecharFolhasDoPeriodo } from "@/server/actions/atividades";
import { EmptyState, PageHeader, adminInputClass } from "@/components/admin/ui";
import { DangerSubmit } from "@/components/admin/DangerSubmit";
import { IconClipboard } from "@/components/admin/icons";
import { EstadoFolhaBadge } from "@/components/premios/EstadoAtividadeBadge";

export const metadata: Metadata = { title: "Folhas de atividade", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FolhasPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodo?: string;
    fechadas?: string;
    abertas?: string;
    porRever?: string;
  }>;
}) {
  await requireGestaoRH();
  const params = await searchParams;
  const periodo = params.periodo ?? periodoAtual();

  const [folhas, disponiveis] = await Promise.all([
    prisma.folhaMensal.findMany({
      where: { periodo },
      orderBy: [{ estado: "asc" }, { user: { name: "asc" } }],
      select: {
        id: true,
        estado: true,
        submetidaEm: true,
        user: {
          select: {
            id: true,
            name: true,
            cargo: { select: { nome: true } },
            departamento: { select: { nome: true } },
          },
        },
        atividades: { select: { estado: true, minutos: true } },
      },
    }),
    periodosDisponiveis(),
  ]);

  const opcoes = disponiveis.includes(periodo) ? disponiveis : [periodo, ...disponiveis];

  // Same rule the bulk action applies, so the button never promises a number
  // the action will not deliver.
  const prontasParaFechar = folhas.filter(
    (f) => f.estado === "SUBMETIDA" && !f.atividades.some((a) => POR_REVER.has(a.estado)),
  ).length;

  const resultado = params.fechadas !== undefined ? {
    fechadas: Number(params.fechadas) || 0,
    abertas: Number(params.abertas) || 0,
    porRever: Number(params.porRever) || 0,
  } : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Folhas de atividade"
        description={`${rotuloPeriodo(periodo)} — valide os registos e feche as folhas antes de calcular o prémio.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <form className="flex items-center gap-2">
              <label htmlFor="periodo" className="sr-only">
                Período
              </label>
              <select
                id="periodo"
                name="periodo"
                defaultValue={periodo}
                className={`${adminInputClass} h-9 w-auto py-0 text-sm`}
              >
                {opcoes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-admin-ghost">
                Ver
              </button>
            </form>

            {prontasParaFechar > 0 && (
              <form action={fecharFolhasDoPeriodo}>
                <input type="hidden" name="periodo" value={periodo} />
                <DangerSubmit
                  confirmMessage={`Fechar ${prontasParaFechar} folha(s) de ${rotuloPeriodo(periodo)} já submetidas e totalmente revistas? As folhas ainda abertas ou com registos por rever ficam como estão.`}
                  confirmLabel="Fechar folhas"
                  tone="primary"
                  className="btn-admin"
                >
                  Fechar {prontasParaFechar} folha(s)
                </DangerSubmit>
              </form>
            )}
          </div>
        }
      />

      {resultado && (
        <div className="card-admin border-lumen/40 p-4 text-sm text-a-muted">
          <p className="font-semibold text-a-text">
            {resultado.fechadas === 0
              ? "Nenhuma folha foi fechada."
              : `${resultado.fechadas} folha(s) fechada(s).`}
          </p>
          {resultado.abertas + resultado.porRever > 0 && (
            <p className="mt-1">
              {[
                resultado.abertas > 0 && `${resultado.abertas} ainda por submeter`,
                resultado.porRever > 0 && `${resultado.porRever} com registos por rever`,
              ]
                .filter(Boolean)
                .join(" e ")}
              . Feche-as uma a uma se quiser fechá-las mesmo assim.
            </p>
          )}
        </div>
      )}

      {folhas.length === 0 ? (
        <div className="card-admin">
          <EmptyState
            icon={<IconClipboard className="h-5 w-5" />}
            title={`Nenhuma folha em ${rotuloPeriodo(periodo)}`}
            description="As folhas são criadas automaticamente quando um colaborador regista a primeira atividade do mês."
          />
        </div>
      ) : (
        <div className="card-admin overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead>
                <tr className="border-b border-a-line text-left text-xs uppercase tracking-wider text-a-faint">
                  <th className="px-5 py-3.5 font-semibold">Colaborador</th>
                  <th className="px-5 py-3.5 font-semibold">Estado</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Registos</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Por rever</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Horas validadas</th>
                  <th className="px-5 py-3.5">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="table-rows">
                {folhas.map((folha) => {
                  const porRever = folha.atividades.filter((a) =>
                    POR_REVER.has(a.estado),
                  ).length;
                  const minutosValidados = folha.atividades
                    .filter((a) => a.estado === "VALIDADA")
                    .reduce((sum, a) => sum + a.minutos, 0);

                  return (
                    <tr key={folha.id}>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-a-text">{folha.user.name}</p>
                        <p className="text-xs text-a-faint">
                          {folha.user.cargo?.nome ?? "Sem cargo"} ·{" "}
                          {folha.user.departamento?.nome ?? "Sem departamento"}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <EstadoFolhaBadge estado={folha.estado} />
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-a-muted">
                        {folha.atividades.length}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right font-mono tabular-nums ${
                          porRever > 0 ? "font-semibold text-lumen-deep" : "text-a-faint"
                        }`}
                      >
                        {porRever > 0 ? porRever : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-a-muted">
                        {formatDuracao(minutosValidados)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/folhas/${folha.id}`}
                            className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
                          >
                            Rever
                          </Link>
                          {folha.estado !== "FECHADA" ? (
                            <form action={acaoFolha}>
                              <input type="hidden" name="folhaId" value={folha.id} />
                              <input type="hidden" name="acao" value="fechar" />
                              <DangerSubmit
                                confirmMessage={
                                  porRever > 0
                                    ? `${folha.user.name} ainda tem ${porRever} registo(s) por rever. Fechar assim? A folha entra no cálculo do prémio, mas registos em justificação tornam o colaborador não elegível.`
                                    : `Fechar a folha de ${folha.user.name}?`
                                }
                                tone="primary"
                                className="btn-admin px-3 py-1.5 text-xs"
                              >
                                Fechar
                              </DangerSubmit>
                            </form>
                          ) : (
                            <form action={acaoFolha}>
                              <input type="hidden" name="folhaId" value={folha.id} />
                              <input type="hidden" name="acao" value="reabrir" />
                              <DangerSubmit
                                confirmMessage={`Reabrir a folha de ${folha.user.name}? Se o prémio deste mês já foi calculado, terá de o recalcular.`}
                                className="btn-row-danger px-3 py-1.5 text-xs"
                              >
                                Reabrir
                              </DangerSubmit>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
