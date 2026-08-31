import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ESCOPO_EMPRESA, carregarPeriodoGuardado } from "@/lib/award/compute";
import { totalPenalizacoes } from "@/lib/award/types";

export const dynamic = "force-dynamic";

/** Quotes a CSV field; the separator is `;` so Excel in pt-PT splits columns. */
function csv(value: string | number | null | undefined): string {
  const texto = value === null || value === undefined ? "" : String(value);
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** pt-PT decimal comma, so Excel reads the numbers as numbers. */
function num(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/**
 * The ranking as a spreadsheet.
 *
 * CSV rather than a real .xlsx: it opens natively in Excel, LibreOffice and
 * Sheets, and adds no dependency. The UTF-8 BOM is what makes Excel render
 * "Pontuação" correctly instead of mojibake.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // Re-read the row: the cookie's role may be stale, and this endpoint exposes
  // every employee's score.
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { role: true, active: true },
  });
  if (!user?.active || (user.role !== "ADMIN" && user.role !== "GESTOR_RH")) {
    return NextResponse.json({ error: "Sem permissões." }, { status: 403 });
  }

  const url = new URL(request.url);
  const periodo = url.searchParams.get("periodo") ?? "";
  const escopo = url.searchParams.get("escopo") || ESCOPO_EMPRESA;

  const guardado = await carregarPeriodoGuardado(periodo, "MENSAL", escopo);
  if (!guardado) {
    return NextResponse.json({ error: "Período não calculado." }, { status: 404 });
  }

  const cabecalho = [
    "Posicao",
    "Nome",
    "Email",
    "Cargo",
    "Departamento",
    "Elegivel",
    "Motivo inelegibilidade",
    "Pontuacao total",
    "Volume (bruto)",
    "Volume (pontos)",
    "Horas (bruto)",
    "Horas (pontos)",
    "Dias com registo",
    "Consistencia (pontos)",
    "Qualidade (%)",
    "Qualidade (pontos)",
    "Pontualidade (%)",
    "Pontualidade (pontos)",
    "Penalizacoes (total)",
    "Penalizacoes (detalhe)",
  ];

  const linhas = [...guardado.elegiveis, ...guardado.naoElegiveis].map((linha) => {
    const c = linha.componentes;
    return [
      linha.posicao ?? "",
      linha.nome,
      linha.email,
      linha.cargoNome ?? "",
      linha.departamentoNome ?? "",
      linha.elegivel ? "Sim" : "Não",
      linha.motivoInelegibilidade ?? "",
      num(linha.pontuacaoTotal),
      num(c.volume.bruto),
      num(c.volume.pontos),
      num(c.horas.bruto),
      num(c.horas.pontos),
      num(c.consistencia.bruto),
      num(c.consistencia.pontos),
      num(c.qualidade.bruto * 100),
      num(c.qualidade.pontos),
      num(c.pontualidade.bruto * 100),
      num(c.pontualidade.pontos),
      num(totalPenalizacoes(linha.penalizacoes)),
      linha.penalizacoes.map((p) => `${p.rotulo} ×${p.quantidade} (−${p.pontos})`).join(" | "),
    ]
      .map(csv)
      .join(";");
  });

  const corpo = ["﻿" + cabecalho.map(csv).join(";"), ...linhas].join("\r\n");
  const sufixo = escopo === ESCOPO_EMPRESA ? "" : `-${escopo}`;

  return new NextResponse(corpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ranking-${periodo}${sufixo}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
