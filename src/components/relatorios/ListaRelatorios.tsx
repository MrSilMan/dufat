import Link from "next/link";
import { formatCentimosNumero } from "@/lib/relatorios/dinheiro";
import { formatDataHoraLuanda, rotuloDiaCurto } from "@/lib/relatorios/dia";
import type { ListaRelatoriosDados } from "@/lib/relatorios/queries";
import { EmptyState, adminInputClass } from "@/components/admin/ui";
import { IconReceipt } from "@/components/admin/icons";
import { EstadoRelatorioBadge } from "@/components/relatorios/ResumoRelatorio";

/**
 * Everyone's daily reports, drafts included, with the filter form — shared by
 * the admin's list and the read-only list a granted viewer sees.
 *
 * Each audience stays inside its own area: `filtroPath` is where the filter
 * form submits (this same list), `detalhePath` prefixes each report's link.
 */
export function ListaRelatorios({
  dados,
  filtroPath,
  detalhePath,
}: {
  dados: ListaRelatoriosDados;
  filtroPath: string;
  detalhePath: string;
}) {
  const { filtros, relatorios, autores, truncado } = dados;

  const soma = relatorios.reduce(
    (acc, r) => ({ vendas: acc.vendas + r.totais.vendas, despesas: acc.despesas + r.totais.despesas }),
    { vendas: 0, despesas: 0 },
  );
  const rascunhos = relatorios.filter((r) => r.estado === "RASCUNHO").length;

  return (
    <div className="space-y-6">
      <form
        action={filtroPath}
        className="card-admin grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_10rem_10rem_10rem_auto] lg:items-end"
      >
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-a-text">Colaborador</span>
          <select name="colaborador" defaultValue={filtros.colaborador ?? ""} className={adminInputClass}>
            <option value="">Todos</option>
            {autores.map((autor) => (
              <option key={autor.id} value={autor.id}>
                {autor.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-a-text">Estado</span>
          <select name="estado" defaultValue={filtros.estado ?? ""} className={adminInputClass}>
            <option value="">Todos</option>
            <option value="RASCUNHO">Rascunho</option>
            <option value="FINALIZADO">Finalizado</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-a-text">Desde</span>
          <input
            type="date"
            name="desde"
            defaultValue={filtros.desde}
            max={filtros.hoje}
            className={adminInputClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-a-text">Até</span>
          <input
            type="date"
            name="ate"
            defaultValue={filtros.ate}
            max={filtros.hoje}
            className={adminInputClass}
          />
        </label>
        <button type="submit" className="btn-admin h-10">
          Filtrar
        </button>
      </form>

      {relatorios.length === 0 ? (
        <div className="card-admin">
          <EmptyState
            icon={<IconReceipt className="h-5 w-5" />}
            title="Nenhum relatório neste intervalo"
            description="Os relatórios aparecem aqui assim que um colaborador abre o dia, ainda antes de o finalizar."
          />
        </div>
      ) : (
        <>
          <p className="text-sm text-a-muted">
            {relatorios.length} relatório(s){rascunhos > 0 ? `, ${rascunhos} em rascunho` : ""} ·
            Vendas {formatCentimosNumero(soma.vendas)} Kz · Despesas{" "}
            {formatCentimosNumero(soma.despesas)} Kz
            {truncado ? ` · a mostrar os ${relatorios.length} mais recentes` : ""}
          </p>
          <div className="card-admin overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-3xl text-sm">
                <thead>
                  <tr className="border-b border-a-line text-left text-xs uppercase tracking-wider text-a-faint">
                    <th className="px-5 py-3.5 font-semibold">Dia</th>
                    <th className="px-5 py-3.5 font-semibold">Colaborador</th>
                    <th className="px-5 py-3.5 font-semibold">Estado</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Linhas</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Vendas (Kz)</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Despesas (Kz)</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Saldo (Kz)</th>
                    <th className="px-5 py-3.5">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="table-rows">
                  {relatorios.map((relatorio) => (
                    <tr key={relatorio.id}>
                      <td className="px-5 py-3.5 whitespace-nowrap text-a-text">
                        {rotuloDiaCurto(relatorio.dia)}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-a-text">{relatorio.autorNome}</p>
                        <p className="text-xs text-a-faint">
                          Alterado {formatDataHoraLuanda(relatorio.updatedAt)}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <EstadoRelatorioBadge estado={relatorio.estado} />
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-a-muted">
                        {relatorio.totais.linhas}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-a-muted">
                        {formatCentimosNumero(relatorio.totais.vendas)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono tabular-nums text-a-muted">
                        {formatCentimosNumero(relatorio.totais.despesas)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold tabular-nums text-a-text">
                        {formatCentimosNumero(relatorio.totais.vendas - relatorio.totais.despesas)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`${detalhePath}/${relatorio.id}`}
                          className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
