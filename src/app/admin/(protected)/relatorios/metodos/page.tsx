import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/auth";
import { alternarMetodoPagamento, guardarMetodoPagamento } from "@/server/actions/relatorios";
import { PageHeader } from "@/components/admin/ui";
import { OrganizacaoSecao } from "@/components/premios/OrganizacaoSecao";

export const metadata: Metadata = { title: "Métodos de pagamento", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The payment methods colaboradores pick from on every sale and expense.
 * Admin only: the list is what the till is reconciled against.
 */
export default async function MetodosPagamentoPage() {
  await requireAdminRole();

  const metodos = await prisma.metodoPagamento.findMany({
    orderBy: [{ ativo: "desc" }, { sortOrder: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, ativo: true, _count: { select: { pagamentos: true } } },
  });

  const semAtivos = metodos.every((m) => !m.ativo);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Métodos de pagamento"
        description="O que os colaboradores escolhem em cada venda e despesa dos relatórios diários."
        backHref="/admin/relatorios"
        backLabel="Relatórios diários"
      />

      {semAtivos && (
        <div className="card-admin border-lumen/40 p-5 text-sm text-a-muted">
          <p className="font-semibold text-a-text">Comece por aqui</p>
          <p className="mt-1">
            Sem pelo menos um método ativo, ninguém consegue registar vendas nem despesas. Exemplos:
            Numerário, Multicaixa Express, TPA, Transferência bancária.
          </p>
        </div>
      )}

      <OrganizacaoSecao
        titulo="Métodos"
        descricao="Desativar um método tira-o da lista para novos registos; os relatórios que já o usaram continuam a mostrá-lo. Mudar o nome não altera os registos já guardados."
        tipo="metodo"
        rotuloNome="método"
        genero="m"
        placeholder="Ex.: Multicaixa Express"
        accao={guardarMetodoPagamento}
        alternar={alternarMetodoPagamento}
        entradas={metodos.map((m) => ({
          id: m.id,
          nome: m.nome,
          ativo: m.ativo,
          detalhe: `Usado em ${m._count.pagamentos} registo(s)`,
        }))}
      />
    </div>
  );
}
