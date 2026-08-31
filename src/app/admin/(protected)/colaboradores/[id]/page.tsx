import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireGestaoRH } from "@/lib/auth";
import { toDia } from "@/lib/award/periodo";
import { PageHeader, RoleBadge } from "@/components/admin/ui";
import { FichaColaboradorForm } from "@/components/premios/FichaColaboradorForm";

export const metadata: Metadata = { title: "Ficha de colaborador", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
  await requireGestaoRH();
  const { id } = await params;

  const [pessoa, cargos, departamentos] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        cargoId: true,
        departamentoId: true,
        dataAdmissao: true,
        dataSaida: true,
        diasSemana: true,
        photoUrl: true,
        _count: { select: { folhas: true, atividades: true } },
      },
    }),
    prisma.cargo.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.departamento.findMany({
      where: { ativo: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, nome: true },
    }),
  ]);
  if (!pessoa) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={pessoa.name}
        description={pessoa.email}
        backHref="/admin/colaboradores"
        backLabel="Colaboradores"
        action={<RoleBadge role={pessoa.role} />}
      />

      {pessoa._count.atividades > 0 && (
        <p className="text-sm text-a-muted">
          {pessoa._count.atividades} atividades registadas em {pessoa._count.folhas} folha(s).{" "}
          <Link href="/admin/folhas" className="text-a-accent hover:underline">
            Ver folhas
          </Link>
        </p>
      )}

      <p className="card-admin p-4 text-sm text-a-muted">
        Alterar o cargo afeta cálculos futuros. Os períodos já confirmados mantêm as pontuações com
        que foram calculados.
      </p>

      <FichaColaboradorForm
        valores={{
          id: pessoa.id,
          nome: pessoa.name,
          cargoId: pessoa.cargoId,
          departamentoId: pessoa.departamentoId,
          dataAdmissao: pessoa.dataAdmissao ? toDia(pessoa.dataAdmissao) : null,
          dataSaida: pessoa.dataSaida ? toDia(pessoa.dataSaida) : null,
          diasSemana: pessoa.diasSemana,
          photoUrl: pessoa.photoUrl,
        }}
        cargos={cargos}
        departamentos={departamentos}
      />
    </div>
  );
}
