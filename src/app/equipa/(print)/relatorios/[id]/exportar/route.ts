import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { centimosParaTexto } from "@/lib/relatorios/dinheiro";
import { formatDataHoraLuanda } from "@/lib/relatorios/dia";
import { ROTULO_TIPO, calcularTotais } from "@/lib/relatorios/resumo";
import { carregarRelatorio } from "@/lib/relatorios/queries";
import { podeVerRelatorio, resolverAcesso } from "@/lib/relatorios/acesso";

export const dynamic = "force-dynamic";

/** Quotes a CSV field; the separator is `;` so Excel in pt-PT splits columns. */
function csv(value: string | number | null | undefined): string {
  const texto = value === null || value === undefined ? "" : String(value);
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const linha = (...campos: (string | number | null | undefined)[]) => campos.map(csv).join(";");

/**
 * Free text typed by a colaborador. A leading `=`, `+`, `-` or `@` would make
 * Excel evaluate the cell as a formula when the admin opens the file, so such
 * values are prefixed with an apostrophe. Amounts never pass through here —
 * a negative balance must stay a number.
 */
function textoSeguro(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * One daily report as a spreadsheet: the lines, the totals and the split by
 * payment method, in blocks separated by a blank row.
 *
 * Amounts are written as "1500,50" — decimal comma, no thousands separator —
 * so Excel in pt-PT reads them as numbers rather than text.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // Re-read the row: the cookie's role may be stale.
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      role: true,
      active: true,
      mustChangePassword: true,
      podeRegistarRelatorios: true,
      podeVerRelatorios: true,
    },
  });
  if (!user?.active || user.mustChangePassword) {
    return NextResponse.json({ error: "Sem permissões." }, { status: 403 });
  }

  const { id } = await params;
  const relatorio = await carregarRelatorio(id);
  // 404 rather than 403 for someone without access: the answer must not
  // confirm that the report exists.
  if (!relatorio || !podeVerRelatorio({ sub: user.id }, resolverAcesso(user), relatorio.autorId)) {
    return NextResponse.json({ error: "Relatório não encontrado." }, { status: 404 });
  }

  const totais = calcularTotais(relatorio.linhas);
  const ordenadas = [...relatorio.linhas].sort((a, b) =>
    a.tipo === b.tipo ? 0 : a.tipo === "VENDA" ? -1 : 1,
  );

  const linhas = [
    linha("Relatório diário de vendas e despesas"),
    linha("Colaborador", textoSeguro(relatorio.autorNome)),
    linha("Dia", relatorio.dia),
    linha("Estado", relatorio.estado === "FINALIZADO" ? "Finalizado" : "Rascunho"),
    linha(
      "Finalizado em",
      relatorio.finalizadoEm ? formatDataHoraLuanda(relatorio.finalizadoEm) : "",
    ),
    linha("Versão", relatorio.versao),
    "",
    linha("Tipo", "Descrição", "Método de pagamento", "Valor (Kz)"),
    ...ordenadas.map((l) =>
      linha(
        ROTULO_TIPO[l.tipo],
        textoSeguro(l.descricao),
        textoSeguro(l.metodoPagamentoNome),
        centimosParaTexto(l.valorCentimos),
      ),
    ),
    "",
    linha("Total de vendas", centimosParaTexto(totais.vendas)),
    linha("Total de despesas", centimosParaTexto(totais.despesas)),
    linha("Saldo", centimosParaTexto(totais.saldo)),
    "",
    linha("Método de pagamento", "Vendas (Kz)", "Despesas (Kz)", "Saldo (Kz)"),
    ...totais.porMetodo.map((m) =>
      linha(
        textoSeguro(m.nome),
        centimosParaTexto(m.vendas),
        centimosParaTexto(m.despesas),
        centimosParaTexto(m.saldo),
      ),
    ),
  ];

  // The UTF-8 BOM is what makes Excel render "Descrição" instead of mojibake.
  const corpo = "\uFEFF" + linhas.join("\r\n");
  const nome = relatorio.autorNome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return new NextResponse(corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${relatorio.dia}-${nome || "colaborador"}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
