import { formatCentimos, quantidadeMilParaTexto } from "@/lib/relatorios/dinheiro";
import { formatDataHoraLuanda } from "@/lib/relatorios/dia";
import { ROTULO_TIPO, type TipoLinha } from "@/lib/relatorios/resumo";

type Entrada = {
  id: string;
  acao: string;
  antes: unknown;
  depois: unknown;
  nota: string | null;
  userName: string;
  createdAt: Date;
};

/** A record as it was written into the history. */
type InstantaneoRegisto = {
  tipo: TipoLinha;
  clienteNome: string | null;
  clienteNif: string | null;
  facturaCodigo: string | null;
  metodoPagamentoNome: string;
  nota: string | null;
  total: number;
  linhas: {
    descricao: string;
    quantidadeMil: number;
    precoUnitarioCentimos: number;
    valorCentimos: number;
    artigoCodigo: string | null;
  }[];
};

/**
 * The shape the history had before records existed, when a line was the unit
 * a colaborador added. Those rows are still in the table and still have to
 * read back, so they are normalised into a one-line record here.
 */
type InstantaneoLinha = {
  tipo: TipoLinha;
  descricao: string;
  valorCentimos: number;
  metodoPagamentoNome: string;
};

const ROTULO_ACAO: Record<string, string> = {
  LINHA_ADICIONADA: "Adicionou linha",
  LINHA_EDITADA: "Editou linha",
  LINHA_APAGADA: "Apagou linha",
  REGISTO_ADICIONADO: "Adicionou registo",
  REGISTO_EDITADO: "Editou registo",
  REGISTO_APAGADO: "Apagou registo",
  FINALIZADO: "Finalizou o relatório",
  REABERTO: "Reabriu o relatório",
};

function comoRegisto(valor: unknown): InstantaneoRegisto | null {
  if (!valor || typeof valor !== "object") return null;
  const v = valor as Partial<InstantaneoRegisto> & Partial<InstantaneoLinha>;

  if (Array.isArray(v.linhas) && typeof v.total === "number") {
    return v as InstantaneoRegisto;
  }
  // A pre-records row: one line, which is exactly a record of one article.
  if (typeof v.descricao === "string" && typeof v.valorCentimos === "number") {
    return {
      tipo: v.tipo as TipoLinha,
      clienteNome: null,
      clienteNif: null,
      facturaCodigo: null,
      metodoPagamentoNome: v.metodoPagamentoNome ?? "—",
      nota: null,
      total: v.valorCentimos,
      linhas: [
        {
          descricao: v.descricao,
          quantidadeMil: 1000,
          precoUnitarioCentimos: v.valorCentimos,
          valorCentimos: v.valorCentimos,
          artigoCodigo: null,
        },
      ],
    };
  }
  return null;
}

function resumoRegisto(registo: InstantaneoRegisto): string {
  const partes = [ROTULO_TIPO[registo.tipo] ?? registo.tipo];
  if (registo.clienteNome) partes.push(registo.clienteNome);
  partes.push(`${registo.linhas.length} artigo(s)`);
  partes.push(formatCentimos(registo.total));
  partes.push(registo.metodoPagamentoNome);
  if (registo.facturaCodigo) partes.push(registo.facturaCodigo);
  return partes.join(" · ");
}

/** "2 × Luminária ST89 — 170 000,00 Kz". */
function resumoArtigo(linha: InstantaneoRegisto["linhas"][number]): string {
  const quantidade = quantidadeMilParaTexto(linha.quantidadeMil);
  const prefixo = quantidade === "1" ? "" : `${quantidade} × `;
  return `${prefixo}${linha.descricao} — ${formatCentimos(linha.valorCentimos)}`;
}

/** Only the fields that actually changed, each as "antes → depois". */
function diferencas(antes: InstantaneoRegisto, depois: InstantaneoRegisto): string[] {
  const mudancas: string[] = [];
  const comparar = (rotulo: string, a: string | null, b: string | null) => {
    if (a !== b) mudancas.push(`${rotulo}: ${a || "—"} → ${b || "—"}`);
  };

  if (antes.tipo !== depois.tipo) {
    mudancas.push(`Tipo: ${ROTULO_TIPO[antes.tipo]} → ${ROTULO_TIPO[depois.tipo]}`);
  }
  comparar("Cliente", antes.clienteNome, depois.clienteNome);
  comparar("NIF", antes.clienteNif, depois.clienteNif);
  comparar("Documento", antes.facturaCodigo, depois.facturaCodigo);
  comparar("Método", antes.metodoPagamentoNome, depois.metodoPagamentoNome);
  comparar("Nota", antes.nota, depois.nota);

  const artigosAntes = antes.linhas.map(resumoArtigo);
  const artigosDepois = depois.linhas.map(resumoArtigo);
  if (artigosAntes.join("|") !== artigosDepois.join("|")) {
    // The articles are listed in full rather than diffed line by line: a record
    // of three items reads better whole than as three separate changes.
    mudancas.push(`Artigos antes: ${artigosAntes.join("; ") || "—"}`);
    mudancas.push(`Artigos depois: ${artigosDepois.join("; ") || "—"}`);
  }
  if (antes.total !== depois.total) {
    mudancas.push(`Total: ${formatCentimos(antes.total)} → ${formatCentimos(depois.total)}`);
  }
  return mudancas;
}

function detalhes(entrada: Entrada): string[] {
  const antes = comoRegisto(entrada.antes);
  const depois = comoRegisto(entrada.depois);

  switch (entrada.acao) {
    case "REGISTO_ADICIONADO":
    case "LINHA_ADICIONADA":
      return depois ? [resumoRegisto(depois), ...depois.linhas.map(resumoArtigo)] : [];
    case "REGISTO_APAGADO":
    case "LINHA_APAGADA":
      return antes ? [resumoRegisto(antes), ...antes.linhas.map(resumoArtigo)] : [];
    case "REGISTO_EDITADO":
    case "LINHA_EDITADA":
      return antes && depois ? diferencas(antes, depois) : [];
    case "FINALIZADO": {
      const t = entrada.depois as {
        linhas?: number;
        vendas?: number;
        despesas?: number;
        saldo?: number;
      } | null;
      if (!t || typeof t.vendas !== "number") return [];
      return [
        `${t.linhas ?? 0} linha(s) · Vendas ${formatCentimos(t.vendas)} · Despesas ${formatCentimos(t.despesas ?? 0)} · Saldo ${formatCentimos(t.saldo ?? 0)}`,
      ];
    }
    case "REABERTO":
      return entrada.nota ? [`Motivo: ${entrada.nota}`] : [];
    default:
      return [];
  }
}

/** Every change to a report, newest first: who, when, and what exactly. */
export function HistoricoRelatorio({ entradas }: { entradas: Entrada[] }) {
  if (entradas.length === 0) {
    return <p className="text-sm text-a-muted">Ainda sem alterações registadas.</p>;
  }

  return (
    <ol className="space-y-3">
      {entradas.map((entrada) => (
        <li key={entrada.id} className="border-l-2 border-a-line-strong pl-4">
          <p className="text-sm text-a-text">
            <span className="font-semibold">{entrada.userName}</span>{" "}
            {(ROTULO_ACAO[entrada.acao] ?? entrada.acao).toLowerCase()}
          </p>
          <p className="text-xs text-a-faint">{formatDataHoraLuanda(entrada.createdAt)}</p>
          {detalhes(entrada).map((texto, indice) => (
            <p key={`${entrada.id}-${indice}`} className="mt-1 text-sm text-a-muted">
              {texto}
            </p>
          ))}
        </li>
      ))}
    </ol>
  );
}
