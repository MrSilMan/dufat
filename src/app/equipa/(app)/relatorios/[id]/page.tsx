import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { formatDataHoraLuanda, rotuloDia } from "@/lib/relatorios/dia";
import { calcularTotais } from "@/lib/relatorios/resumo";
import { requireAcessoRelatorios } from "@/lib/relatorios/acesso";
import { carregarHistorico, carregarRelatorio, metodosAtivos } from "@/lib/relatorios/queries";
import { PageHeader } from "@/components/admin/ui";
import { EditorRelatorio } from "@/components/relatorios/EditorRelatorio";
import { BotoesDownload, DetalheRelatorio } from "@/components/relatorios/DetalheRelatorio";
import {
  EstadoRelatorioBadge,
  ResumoRelatorio,
  TabelaRegistos,
} from "@/components/relatorios/ResumoRelatorio";

export const metadata: Metadata = { title: "Relatório diário", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * One day's report: for its author, the live editor while it is a draft and a
 * record once finalized; for someone granted read access, the reviewer's
 * read-only view with its history.
 */
export default async function RelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, acesso } = await requireAcessoRelatorios();
  const { id } = await params;

  const relatorio = await carregarRelatorio(id);
  if (!relatorio) notFound();

  if (relatorio.autorId !== session.sub || !acesso.registar) {
    // The admin reviews from the back-office, where reopening lives.
    if (acesso.admin) redirect(`/admin/relatorios/${id}`);
    if (!acesso.ver) notFound();

    const historico = await carregarHistorico(id);
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vendas e despesas"
          title={rotuloDia(relatorio.dia)}
          description={relatorio.autorNome}
          backHref="/equipa/relatorios/equipa"
          backLabel="Relatórios da equipa"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <EstadoRelatorioBadge estado={relatorio.estado} />
              <BotoesDownload relatorioId={relatorio.id} />
            </div>
          }
        />
        <DetalheRelatorio relatorio={relatorio} historico={historico} />
      </div>
    );
  }

  const rascunho = relatorio.estado === "RASCUNHO";
  const metodos = rascunho ? await metodosAtivos() : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vendas e despesas"
        title={rotuloDia(relatorio.dia)}
        backHref="/equipa/relatorios"
        backLabel="Relatórios"
        action={<EstadoRelatorioBadge estado={relatorio.estado} />}
      />

      {rascunho ? (
        <EditorRelatorio
          relatorioId={relatorio.id}
          versao={relatorio.versao}
          registos={relatorio.registos}
          metodos={metodos}
        />
      ) : (
        <>
          <div className="card-admin flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-a-muted">
              Finalizado
              {relatorio.finalizadoEm ? ` em ${formatDataHoraLuanda(relatorio.finalizadoEm)}` : ""}.
              Já não pode ser alterado.
            </p>
            <div className="flex flex-wrap gap-2">
              <BotoesDownload relatorioId={relatorio.id} className="btn-admin-ghost min-h-11" />
            </div>
          </div>
          <TabelaRegistos registos={relatorio.registos} />
          <ResumoRelatorio totais={calcularTotais(relatorio.registos)} />
        </>
      )}
    </div>
  );
}
