import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireGestaoRH } from "@/lib/auth";
import {
  guardarCargo,
  guardarCategoriaAtividade,
  guardarDepartamento,
} from "@/server/actions/organizacao";
import { PageHeader } from "@/components/admin/ui";
import { OrganizacaoSecao } from "@/components/premios/OrganizacaoSecao";

export const metadata: Metadata = { title: "Organização", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The reference data the whole award module rests on.
 *
 * Nobody can be registered as an employee until at least one cargo exists, and
 * nobody can log anything until at least one activity category does — so this
 * screen is the real starting point, and it says so when the lists are empty.
 */
export default async function OrganizacaoPage() {
  await requireGestaoRH();

  const [cargos, departamentos, categorias] = await Promise.all([
    prisma.cargo.findMany({
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      select: {
        id: true,
        nome: true,
        ativo: true,
        diasSemana: true,
        _count: { select: { users: true } },
      },
    }),
    prisma.departamento.findMany({
      orderBy: [{ ativo: "desc" }, { sortOrder: "asc" }],
      select: {
        id: true,
        nome: true,
        ativo: true,
        _count: { select: { users: true } },
      },
    }),
    prisma.categoriaAtividade.findMany({
      orderBy: [{ ativo: "desc" }, { sortOrder: "asc" }],
      select: { id: true, nome: true, ativo: true, isOutro: true },
    }),
  ]);

  const semCargos = cargos.filter((c) => c.ativo).length === 0;
  const semCategorias = categorias.filter((c) => c.ativo).length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Organização"
        description="Cargos, departamentos e categorias de atividade — a base sobre a qual o prémio é calculado."
      />

      {(semCargos || semCategorias) && (
        <div className="card-admin border-lumen/40 p-5">
          <p className="text-sm font-semibold text-a-text">Comece por aqui</p>
          <ul className="mt-2 space-y-1 text-sm text-a-muted">
            {semCargos && (
              <li>
                Crie os <strong className="text-a-text">cargos</strong> da empresa (Caixa,
                Contabilista, Técnico…). Sem pelo menos um cargo não é possível registar
                colaboradores, e o prémio não tem contra quem comparar cada pessoa.
              </li>
            )}
            {semCategorias && (
              <li>
                Crie as <strong className="text-a-text">categorias de atividade</strong>. Sem
                elas, ninguém consegue registar o que fez.
              </li>
            )}
          </ul>
          {!semCargos && !semCategorias ? null : (
            <p className="mt-3 text-xs text-a-faint">
              Os departamentos são opcionais — só são precisos se quiser um vencedor por
              departamento.
            </p>
          )}
        </div>
      )}

      <OrganizacaoSecao
        titulo="Cargos"
        descricao="O cargo define contra quem cada pessoa é comparada: volume e horas são normalizados contra a mediana do próprio cargo, porque um Caixa e um Contabilista não são comparáveis em números brutos."
        tipo="cargo"
        rotuloNome="cargo"
        genero="m"
        placeholder="Ex.: Fiel de Armazém"
        accao={guardarCargo}
        comDiasSemana
        entradas={cargos.map((c) => ({
          id: c.id,
          nome: c.nome,
          ativo: c.ativo,
          diasSemana: c.diasSemana,
          emUso: c._count.users,
        }))}
      />

      <OrganizacaoSecao
        titulo="Departamentos"
        descricao="Opcionais. Só são necessários se ativar um vencedor por departamento, o que faz sentido acima de cerca de 30 colaboradores."
        tipo="departamento"
        rotuloNome="departamento"
        genero="m"
        placeholder="Ex.: Armazém e Logística"
        accao={guardarDepartamento}
        entradas={departamentos.map((d) => ({
          id: d.id,
          nome: d.nome,
          ativo: d.ativo,
          emUso: d._count.users,
        }))}
      />

      <OrganizacaoSecao
        titulo="Categorias de atividade"
        descricao='O que os colaboradores escolhem ao registar trabalho. Marque como "Outro" a categoria genérica — um mês de trabalho por classificar não pode ser avaliado, por isso passa a descontar pontos acima do limite definido nos parâmetros.'
        tipo="categoria"
        rotuloNome="categoria"
        genero="f"
        placeholder="Ex.: Conferência de stock"
        accao={guardarCategoriaAtividade}
        comOutro
        entradas={categorias.map((c) => ({
          id: c.id,
          nome: c.nome,
          ativo: c.ativo,
          isOutro: c.isOutro,
        }))}
      />

      <p className="text-xs text-a-faint">
        As entradas são desativadas, nunca apagadas: um cargo já usado faz parte da forma como os
        períodos anteriores foram calculados.{" "}
        <Link href="/admin/colaboradores" className="text-a-accent hover:underline">
          Ir para Colaboradores
        </Link>
      </p>
    </div>
  );
}
