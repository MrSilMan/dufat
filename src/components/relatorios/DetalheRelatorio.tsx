import type { ReactNode } from "react";
import Link from "next/link";
import { formatDataHoraLuanda } from "@/lib/relatorios/dia";
import { calcularTotais } from "@/lib/relatorios/resumo";
import type { RelatorioCarregado, carregarHistorico } from "@/lib/relatorios/queries";
import { IconDownload } from "@/components/admin/icons";
import { HistoricoRelatorio } from "@/components/relatorios/HistoricoRelatorio";
import { ResumoRelatorio, TabelaRegistos } from "@/components/relatorios/ResumoRelatorio";

/** PDF (print page) and CSV for one report; both check access themselves. */
export function BotoesDownload({ relatorioId, className = "btn-admin-ghost" }: { relatorioId: string; className?: string }) {
  return (
    <>
      <Link href={`/equipa/relatorios/${relatorioId}/imprimir`} target="_blank" className={className}>
        <IconDownload className="h-4 w-4" />
        PDF
      </Link>
      <a href={`/equipa/relatorios/${relatorioId}/exportar`} className={className}>
        <IconDownload className="h-4 w-4" />
        CSV
      </a>
    </>
  );
}

/**
 * One report as a reviewer reads it — the admin, or someone granted read
 * access: current lines and totals, live if still a draft, and every change
 * that led there. `acoes` slots in what only some reviewers may do.
 */
export function DetalheRelatorio({
  relatorio,
  historico,
  acoes,
}: {
  relatorio: RelatorioCarregado;
  historico: Awaited<ReturnType<typeof carregarHistorico>>;
  acoes?: ReactNode;
}) {
  const finalizado = relatorio.estado === "FINALIZADO";
  const { apagado } = relatorio;

  return (
    <div className="space-y-8">
      {apagado ? (
        <div className="card-admin space-y-1 border-rose-500/40 p-4 text-sm">
          <p className="font-semibold text-a-text">
            Apagado em {formatDataHoraLuanda(apagado.em)}
            {apagado.porNome ? ` por ${apagado.porNome}` : ""}.
          </p>
          {apagado.motivo && <p className="text-a-muted">Motivo: {apagado.motivo}</p>}
          <p className="text-a-muted">
            Não aparece nas listas nem conta nos totais, e o colaborador não o pode alterar. Estava{" "}
            {finalizado ? "finalizado" : "em rascunho"}.
          </p>
        </div>
      ) : (
        <p className="text-sm text-a-muted">
          {finalizado
            ? `Finalizado${relatorio.finalizadoEm ? ` em ${formatDataHoraLuanda(relatorio.finalizadoEm)}` : ""}${relatorio.finalizadoPorNome ? ` por ${relatorio.finalizadoPorNome}` : ""}.`
            : `Rascunho em curso — última alteração ${formatDataHoraLuanda(relatorio.updatedAt)}. Recarregue a página para ver as alterações mais recentes.`}
        </p>
      )}

      {/* Side by side only on wide screens: next to the admin sidebar, a 1280px
          viewport leaves the lines table too narrow to read. The single column
          below that is `minmax(0, 1fr)` rather than the default `auto`, or it
          grows to the table by method's minimum width and the whole page
          scrolls sideways on a phone instead of just that table. */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 2xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <TabelaRegistos registos={relatorio.registos} />
          <ResumoRelatorio totais={calcularTotais(relatorio.registos)} />
          {acoes}
        </div>

        <aside className="card-admin p-5 2xl:sticky 2xl:top-6">
          <h2 className="mb-4 font-display text-base font-bold text-a-text">Histórico</h2>
          <HistoricoRelatorio entradas={historico} />
        </aside>
      </div>
    </div>
  );
}
