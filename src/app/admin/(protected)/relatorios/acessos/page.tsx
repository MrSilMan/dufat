import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/validation";
import { PageHeader } from "@/components/admin/ui";
import { AcessoRelatoriosLinha } from "@/components/relatorios/AcessoRelatoriosLinha";

export const metadata: Metadata = { title: "Acessos aos relatórios", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Who may use the daily reports. Nobody may until they are switched on here;
 * administrators always have full access and are listed apart.
 */
export default async function AcessosRelatoriosPage() {
  await requireAdminRole();

  const utilizadores = await prisma.user.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      podeRegistarRelatorios: true,
      podeVerRelatorios: true,
      cargo: { select: { nome: true } },
    },
  });

  const administradores = utilizadores.filter((u) => u.role === "ADMIN");
  const restantes = utilizadores.filter((u) => u.role !== "ADMIN");
  const comAcesso = restantes.filter((u) => u.podeRegistarRelatorios || u.podeVerRelatorios).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Acessos aos relatórios"
        description="Escolha quem pode registar os seus relatórios diários e quem pode ver os relatórios de todos. Quem não tiver nenhum dos dois não vê nada sobre relatórios."
        backHref="/admin/relatorios"
        backLabel="Relatórios diários"
      />

      <section className="card-admin p-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-a-line pb-4">
          <h2 className="font-display text-base font-bold text-a-text">Utilizadores</h2>
          <p className="text-xs text-a-faint">
            {comAcesso} de {restantes.length} com acesso
          </p>
        </div>

        {restantes.length === 0 ? (
          <p className="py-6 text-sm text-a-muted">Ainda não há outros utilizadores ativos.</p>
        ) : (
          <ul className="divide-y divide-a-line">
            {restantes.map((u) => (
              <AcessoRelatoriosLinha
                key={u.id}
                userId={u.id}
                nome={u.name}
                detalhe={[u.email, ROLE_LABELS[u.role], u.cargo?.nome].filter(Boolean).join(" · ")}
                inicial={{ registar: u.podeRegistarRelatorios, ver: u.podeVerRelatorios }}
              />
            ))}
          </ul>
        )}
      </section>

      {administradores.length > 0 && (
        <p className="text-xs text-a-faint">
          Com acesso total por serem administradores:{" "}
          {administradores.map((u) => u.name).join(", ")}.
        </p>
      )}
    </div>
  );
}
