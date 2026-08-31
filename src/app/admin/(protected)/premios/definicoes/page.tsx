import type { Metadata } from "next";
import { requireAdminRole } from "@/lib/auth";
import { getAwardParametros } from "@/lib/award/settings";
import { PageHeader } from "@/components/admin/ui";
import { DefinicoesPremioForm } from "@/components/premios/DefinicoesPremioForm";

export const metadata: Metadata = { title: "Parâmetros do prémio", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DefinicoesPremioPage() {
  await requireAdminRole();
  const parametros = await getAwardParametros();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Parâmetros do prémio"
        description="Pesos, penalizações e limiares do Funcionário do Mês."
        backHref="/admin/premios"
        backLabel="Ranking do mês"
      />

      <p className="card-admin p-4 text-sm text-a-muted">
        Alterar estes valores só afeta cálculos futuros. Cada período guarda os parâmetros com que
        foi calculado, para que as pontuações já publicadas continuem a fazer sentido meses depois.
      </p>

      <DefinicoesPremioForm parametros={parametros} />
    </div>
  );
}
