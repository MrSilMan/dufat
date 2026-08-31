import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireGestaoRH } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { isMailConfigured } from "@/lib/mail";
import { EmptyState, PageHeader, RoleBadge } from "@/components/admin/ui";
import { IconUsers } from "@/components/admin/icons";
import { InviteForm } from "@/components/admin/InviteForm";

export const metadata: Metadata = { title: "Colaboradores", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ColaboradoresPage() {
  const session = await requireGestaoRH();

  const [cargos, departamentos] = await Promise.all([
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

  const pessoas = await prisma.user.findMany({
    where: { active: true },
    orderBy: [{ cargoId: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      dataAdmissao: true,
      dataSaida: true,
      diasSemana: true,
      cargo: { select: { nome: true, diasSemana: true } },
      departamento: { select: { nome: true } },
    },
  });

  // Someone marked COLABORADOR but with no cargo logs activity that can never
  // be ranked — the most useful thing this screen does is make that visible.
  const semCargo = pessoas.filter((p) => p.role === "COLABORADOR" && !p.cargo);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Colaboradores"
        description="O cargo define contra quem cada pessoa é comparada no prémio; as datas definem quantos dias de trabalho lhe são exigidos."
        action={
          session.role === "ADMIN" && (
            <Link href="/admin/team" className="btn-admin-ghost">
              Gerir permissões
            </Link>
          )
        }
      />

      <InviteForm
        mailConfigured={isMailConfigured()}
        cargos={cargos}
        departamentos={departamentos}
        apenasColaborador
      />

      {semCargo.length > 0 && (
        <div className="card-admin border-lumen/40 p-4">
          <p className="text-sm font-semibold text-a-text">
            {semCargo.length} colaborador(es) sem cargo atribuído
          </p>
          <p className="mt-1 text-sm text-a-muted">
            {semCargo.map((p) => p.name).join(", ")} — a atividade que registarem não entra em
            nenhum ranking até terem cargo.
          </p>
        </div>
      )}

      {pessoas.length === 0 ? (
        <div className="card-admin">
          <EmptyState
            icon={<IconUsers className="h-5 w-5" />}
            title="Nenhum colaborador"
            description="Registe membros da equipa a partir do ecrã Equipa."
          />
        </div>
      ) : (
        <div className="card-admin overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-4xl text-sm">
              <thead>
                <tr className="border-b border-a-line text-left text-xs uppercase tracking-wider text-a-faint">
                  <th className="px-5 py-3.5 font-semibold">Pessoa</th>
                  <th className="px-5 py-3.5 font-semibold">Permissões</th>
                  <th className="px-5 py-3.5 font-semibold">Cargo</th>
                  <th className="px-5 py-3.5 font-semibold">Departamento</th>
                  <th className="px-5 py-3.5 font-semibold">Admissão</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Dias/sem.</th>
                  <th className="px-5 py-3.5">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="table-rows">
                {pessoas.map((pessoa) => (
                  <tr key={pessoa.id}>
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-a-text">{pessoa.name}</p>
                      <p className="font-mono text-xs text-a-faint">{pessoa.email}</p>
                      {pessoa.dataSaida && (
                        <p className="mt-0.5 text-xs text-rose-500">
                          Saiu em {formatDate(pessoa.dataSaida)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <RoleBadge role={pessoa.role} />
                    </td>
                    <td className="px-5 py-3.5">
                      {pessoa.cargo ? (
                        <span className="text-a-text">{pessoa.cargo.nome}</span>
                      ) : (
                        <span className="text-a-faint">
                          {pessoa.role === "COLABORADOR" ? "— por definir" : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-a-muted">
                      {pessoa.departamento?.nome ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-a-muted">
                      {pessoa.dataAdmissao ? formatDate(pessoa.dataAdmissao) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono tabular-nums text-a-muted">
                      {pessoa.diasSemana ?? pessoa.cargo?.diasSemana ?? "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end">
                        <Link
                          href={`/admin/colaboradores/${pessoa.id}`}
                          className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
                        >
                          Editar ficha
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
