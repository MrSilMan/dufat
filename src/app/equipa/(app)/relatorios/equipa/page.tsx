import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAcessoRelatorios } from "@/lib/relatorios/acesso";
import { listarRelatorios } from "@/lib/relatorios/queries";
import { PageHeader } from "@/components/admin/ui";
import { ListaRelatorios } from "@/components/relatorios/ListaRelatorios";
import { SeparadoresRelatorios } from "@/components/relatorios/SeparadoresRelatorios";

export const metadata: Metadata = { title: "Relatórios da equipa", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Everyone's reports, read-only, for someone the admin granted "ver". */
export default async function RelatoriosEquipaPage({
  searchParams,
}: {
  searchParams: Promise<{ colaborador?: string; estado?: string; desde?: string; ate?: string }>;
}) {
  const { acesso } = await requireAcessoRelatorios();
  if (!acesso.ver) notFound();

  const dados = await listarRelatorios(await searchParams);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vendas e despesas"
        title="Relatórios da equipa"
        description="Os relatórios diários de todos os colaboradores, incluindo rascunhos em curso. Só de leitura."
      />

      <SeparadoresRelatorios ativo="equipa" registar={acesso.registar} ver={acesso.ver} />

      <ListaRelatorios
        dados={dados}
        filtroPath="/equipa/relatorios/equipa"
        detalhePath="/equipa/relatorios"
      />
    </div>
  );
}
