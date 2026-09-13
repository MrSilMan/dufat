import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminRole } from "@/lib/auth";
import { rotuloDia } from "@/lib/relatorios/dia";
import { carregarHistorico, carregarRelatorio } from "@/lib/relatorios/queries";
import { PageHeader } from "@/components/admin/ui";
import { BotoesDownload, DetalheRelatorio } from "@/components/relatorios/DetalheRelatorio";
import { ReabrirRelatorioForm } from "@/components/relatorios/ReabrirRelatorioForm";
import { EstadoRelatorioBadge } from "@/components/relatorios/ResumoRelatorio";

export const metadata: Metadata = { title: "Relatório diário", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The admin's view of one report — the read-only view, plus reopening. */
export default async function RelatorioAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reaberto?: string }>;
}) {
  await requireAdminRole();
  const { id } = await params;
  const { reaberto } = await searchParams;

  const [relatorio, historico] = await Promise.all([carregarRelatorio(id), carregarHistorico(id)]);
  if (!relatorio) notFound();

  const finalizado = relatorio.estado === "FINALIZADO";

  return (
    <div className="space-y-8">
      <PageHeader
        title={rotuloDia(relatorio.dia)}
        description={`${relatorio.autorNome} · ${relatorio.autorEmail}`}
        backHref="/admin/relatorios"
        backLabel="Relatórios diários"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EstadoRelatorioBadge estado={relatorio.estado} />
            <BotoesDownload relatorioId={relatorio.id} />
          </div>
        }
      />

      {reaberto && !finalizado && (
        <p role="status" className="card-admin border-emerald-500/40 p-4 text-sm text-a-text">
          Relatório reaberto. O colaborador já o pode corrigir e finalizar de novo.
        </p>
      )}

      <DetalheRelatorio
        relatorio={relatorio}
        historico={historico}
        acoes={finalizado ? <ReabrirRelatorioForm relatorioId={relatorio.id} /> : undefined}
      />
    </div>
  );
}
