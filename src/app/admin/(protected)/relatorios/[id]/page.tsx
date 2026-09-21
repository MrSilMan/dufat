import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminRole } from "@/lib/auth";
import { hojeLuanda, rotuloDia } from "@/lib/relatorios/dia";
import { carregarHistorico, carregarRelatorio } from "@/lib/relatorios/queries";
import { PageHeader } from "@/components/admin/ui";
import { ApagarRelatorioForm } from "@/components/relatorios/ApagarRelatorioForm";
import { BotoesDownload, DetalheRelatorio } from "@/components/relatorios/DetalheRelatorio";
import { MudarDiaRelatorioForm } from "@/components/relatorios/MudarDiaRelatorioForm";
import { ReabrirRelatorioForm } from "@/components/relatorios/ReabrirRelatorioForm";
import { RestaurarRelatorioForm } from "@/components/relatorios/RestaurarRelatorioForm";
import { EstadoRelatorioBadge } from "@/components/relatorios/ResumoRelatorio";

export const metadata: Metadata = { title: "Relatório diário", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The admin's view of one report — the read-only view, plus reopening, moving
 * and deleting it. A deleted report still opens here, to be restored.
 */
export default async function RelatorioAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reaberto?: string; apagado?: string; restaurado?: string }>;
}) {
  await requireAdminRole();
  const { id } = await params;
  const avisos = await searchParams;

  const [relatorio, historico] = await Promise.all([
    carregarRelatorio(id, { incluirApagado: true }),
    carregarHistorico(id),
  ]);
  if (!relatorio) notFound();

  const finalizado = relatorio.estado === "FINALIZADO";
  const apagado = relatorio.apagado !== null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={rotuloDia(relatorio.dia)}
        description={`${relatorio.autorNome} · ${relatorio.autorEmail}`}
        backHref="/admin/relatorios"
        backLabel="Relatórios diários"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EstadoRelatorioBadge estado={relatorio.estado} apagado={apagado} />
            {/* The PDF and CSV refuse a deleted report, like every other copy. */}
            {!apagado && <BotoesDownload relatorioId={relatorio.id} />}
          </div>
        }
      />

      {avisos.reaberto && !finalizado && !apagado && (
        <p role="status" className="card-admin border-emerald-500/40 p-4 text-sm text-a-text">
          Relatório reaberto. O colaborador já o pode corrigir e finalizar de novo.
        </p>
      )}
      {avisos.apagado && apagado && (
        <p role="status" className="card-admin border-emerald-500/40 p-4 text-sm text-a-text">
          Relatório apagado. Já não aparece nas listas nem conta nos totais. Se foi engano, pode
          restaurá-lo em baixo.
        </p>
      )}
      {avisos.restaurado && !apagado && (
        <p role="status" className="card-admin border-emerald-500/40 p-4 text-sm text-a-text">
          Relatório restaurado. Voltou às listas e aos totais.
        </p>
      )}

      <DetalheRelatorio
        relatorio={relatorio}
        historico={historico}
        acoes={
          apagado ? (
            <RestaurarRelatorioForm relatorioId={relatorio.id} />
          ) : (
            <>
              {finalizado && <ReabrirRelatorioForm relatorioId={relatorio.id} />}
              <MudarDiaRelatorioForm
                relatorioId={relatorio.id}
                dia={relatorio.dia}
                hoje={hojeLuanda()}
              />
              <ApagarRelatorioForm
                relatorioId={relatorio.id}
                registos={relatorio.registos.length}
              />
            </>
          )
        }
      />
    </div>
  );
}
