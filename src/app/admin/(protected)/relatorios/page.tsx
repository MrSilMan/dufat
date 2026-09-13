import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminRole } from "@/lib/auth";
import { listarRelatorios } from "@/lib/relatorios/queries";
import { PageHeader } from "@/components/admin/ui";
import { ListaRelatorios } from "@/components/relatorios/ListaRelatorios";

export const metadata: Metadata = { title: "Relatórios diários", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Every colaborador's daily reports, drafts included — the admin sees a day
 * being filled in, not only the closed result.
 */
export default async function RelatoriosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ colaborador?: string; estado?: string; desde?: string; ate?: string }>;
}) {
  await requireAdminRole();
  const dados = await listarRelatorios(await searchParams);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Relatórios diários"
        description="Vendas e despesas registadas pelos colaboradores, incluindo rascunhos ainda em curso."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/relatorios/acessos" className="btn-admin-ghost">
              Acessos
            </Link>
            <Link href="/admin/relatorios/metodos" className="btn-admin-ghost">
              Métodos de pagamento
            </Link>
          </div>
        }
      />

      <ListaRelatorios dados={dados} filtroPath="/admin/relatorios" detalhePath="/admin/relatorios" />
    </div>
  );
}
