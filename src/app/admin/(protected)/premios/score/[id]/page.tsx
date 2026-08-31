import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireGestaoRH } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { rotuloPeriodo } from "@/lib/award/periodo";
import type { Componentes, Penalizacao } from "@/lib/award/types";
import { PageHeader } from "@/components/admin/ui";
import { ScoreBreakdown } from "@/components/premios/ScoreBreakdown";

export const metadata: Metadata = { title: "Detalhe do colaborador", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DetalheScorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireGestaoRH();
  const { id } = await params;

  const score = await prisma.awardScore.findUnique({
    where: { id },
    include: {
      awardPeriod: {
        select: {
          id: true,
          periodo: true,
          tipo: true,
          escopo: true,
          estado: true,
          vencedorId: true,
          propostoId: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          photoUrl: true,
          dataAdmissao: true,
          diasSemana: true,
          cargo: { select: { nome: true } },
          departamento: { select: { nome: true } },
        },
      },
    },
  });
  if (!score) notFound();

  const { awardPeriod: period, user } = score;
  const componentes = score.componentes as unknown as Componentes;
  const penalizacoes = (score.penalizacoes as unknown as Penalizacao[]) ?? [];

  const folha = await prisma.folhaMensal.findUnique({
    where: { userId_periodo: { userId: user.id, periodo: period.periodo } },
    select: {
      id: true,
      estado: true,
      submetidaEm: true,
      prazoSubmissao: true,
      _count: { select: { atividades: true } },
    },
  });

  const eVencedor = period.vencedorId === user.id;
  const eProposto = period.propostoId === user.id;

  return (
    <div className="space-y-8">
      <PageHeader
        title={user.name}
        description={`${user.cargo?.nome ?? "Sem cargo"} · ${user.departamento?.nome ?? "Sem departamento"} · ${rotuloPeriodo(period.periodo)}`}
        backHref={`/admin/premios?periodo=${period.periodo}&dep=${period.escopo}`}
        backLabel="Ranking do mês"
        action={
          folha && (
            <Link href={`/admin/folhas/${folha.id}`} className="btn-admin-ghost">
              Ver folha do mês
            </Link>
          )
        }
      />

      <div className="flex flex-wrap gap-2">
        {score.elegivel ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium badge-success">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            Elegível · {score.posicao}.º lugar
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium badge-neutral">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            Não elegível
          </span>
        )}
        {eVencedor && (
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium badge-warm">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            Vencedor confirmado
          </span>
        )}
        {eProposto && !eVencedor && (
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium badge-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
            Proposto pelo sistema
          </span>
        )}
      </div>

      {!score.elegivel && score.motivoInelegibilidade && (
        <div className="card-admin border-rose-500/30 p-5">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.2em] text-rose-500">
            Motivo da exclusão
          </p>
          <p className="mt-2 text-sm text-a-text">{score.motivoInelegibilidade}</p>
          <p className="mt-3 text-xs text-a-faint">
            A pontuação abaixo foi calculada na mesma, para referência — não conta para o ranking
            deste período.
          </p>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="card-admin p-6">
          <h2 className="mb-5 border-b border-a-line pb-4 font-display text-base font-bold text-a-text">
            Como esta pontuação foi construída
          </h2>
          <ScoreBreakdown
            componentes={componentes}
            penalizacoes={penalizacoes}
            pontuacaoTotal={Number(score.pontuacaoTotal)}
          />
        </section>

        <aside className="space-y-6 xl:sticky xl:top-6">
          <section className="card-admin p-5">
            <h2 className="font-display text-sm font-bold text-a-text">Folha do mês</h2>
            {folha ? (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-a-muted">Estado</dt>
                  <dd className="font-medium text-a-text">{folha.estado}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-a-muted">Atividades</dt>
                  <dd className="font-mono tabular-nums text-a-text">
                    {folha._count.atividades}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-a-muted">Submetida</dt>
                  <dd className="text-right text-xs text-a-text">
                    {folha.submetidaEm ? formatDate(folha.submetidaEm) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-a-muted">Prazo</dt>
                  <dd className="text-right text-xs text-a-text">
                    {folha.prazoSubmissao ? formatDate(folha.prazoSubmissao) : "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-a-muted">Sem folha para este período.</p>
            )}
          </section>

          <section className="card-admin p-5">
            <h2 className="font-display text-sm font-bold text-a-text">Colaborador</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-a-muted">Email</dt>
                <dd className="truncate font-mono text-xs text-a-text">{user.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-a-muted">Admissão</dt>
                <dd className="text-xs text-a-text">
                  {user.dataAdmissao ? formatDate(user.dataAdmissao) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-a-muted">Dias/semana</dt>
                <dd className="font-mono tabular-nums text-a-text">{user.diasSemana ?? "—"}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
