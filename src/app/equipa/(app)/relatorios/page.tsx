import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAcessoRelatorios } from "@/lib/relatorios/acesso";
import { formatCentimos } from "@/lib/relatorios/dinheiro";
import { dateParaDia, hojeLuanda, rotuloDia } from "@/lib/relatorios/dia";
import { totaisPorRelatorio } from "@/lib/relatorios/queries";
import { PageHeader } from "@/components/admin/ui";
import { IconReceipt } from "@/components/admin/icons";
import { NovoRelatorioForm } from "@/components/relatorios/NovoRelatorioForm";
import { EstadoRelatorioBadge } from "@/components/relatorios/ResumoRelatorio";
import { SeparadoresRelatorios } from "@/components/relatorios/SeparadoresRelatorios";

export const metadata: Metadata = { title: "Vendas e despesas", robots: { index: false } };
export const dynamic = "force-dynamic";

const LIMITE = 60;

/**
 * The colaborador's own daily reports, newest day first.
 *
 * Someone granted only read access keeps nothing of their own, so the tab
 * takes them straight to the team's reports instead.
 */
export default async function MeusRelatoriosPage() {
  const { session, acesso } = await requireAcessoRelatorios();
  if (!acesso.registar) redirect("/equipa/relatorios/equipa");
  const hoje = hojeLuanda();

  const relatorios = await prisma.relatorioDiario.findMany({
    where: { userId: session.sub },
    orderBy: { dia: "desc" },
    take: LIMITE,
    select: { id: true, dia: true, estado: true, updatedAt: true },
  });
  const totais = await totaisPorRelatorio(relatorios.map((r) => r.id));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Equipa"
        title="Vendas e despesas"
        description="Um relatório por dia. Cada linha é guardada automaticamente enquanto trabalha; no fim do dia, finalize-o."
      />

      <SeparadoresRelatorios ativo="meus" registar={acesso.registar} ver={acesso.ver} />

      <NovoRelatorioForm hoje={hoje} />

      {relatorios.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-a-line-strong p-10 text-center">
          <span
            aria-hidden
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-a-inset text-a-faint"
          >
            <IconReceipt className="h-5 w-5" />
          </span>
          <p className="mt-3 font-semibold text-a-text">Ainda não tem relatórios.</p>
          <p className="mt-1 text-sm text-a-muted">Abra o relatório de hoje para começar.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {relatorios.map((relatorio) => {
            const dia = dateParaDia(relatorio.dia);
            const t = totais.get(relatorio.id) ?? { vendas: 0, despesas: 0, linhas: 0 };
            return (
              <li key={relatorio.id}>
                <Link
                  href={`/equipa/relatorios/${relatorio.id}`}
                  className="card-admin flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-a-line-strong"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-a-text">
                      {dia === hoje ? "Hoje" : rotuloDia(dia)}
                    </p>
                    <p className="mt-0.5 text-xs text-a-muted">
                      {t.linhas} linha(s) · Vendas {formatCentimos(t.vendas)} · Despesas{" "}
                      {formatCentimos(t.despesas)}
                    </p>
                  </div>
                  <EstadoRelatorioBadge estado={relatorio.estado} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {relatorios.length === LIMITE && (
        <p className="text-xs text-a-faint">A mostrar os {LIMITE} dias mais recentes.</p>
      )}
    </div>
  );
}
