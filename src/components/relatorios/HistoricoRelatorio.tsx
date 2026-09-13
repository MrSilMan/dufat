import { formatCentimos } from "@/lib/relatorios/dinheiro";
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

type Instantaneo = {
  tipo: TipoLinha;
  descricao: string;
  valorCentimos: number;
  metodoPagamentoNome: string;
};

const ROTULO_ACAO: Record<string, string> = {
  LINHA_ADICIONADA: "Adicionou linha",
  LINHA_EDITADA: "Editou linha",
  LINHA_APAGADA: "Apagou linha",
  FINALIZADO: "Finalizou o relatório",
  REABERTO: "Reabriu o relatório",
};

function comoLinha(valor: unknown): Instantaneo | null {
  if (!valor || typeof valor !== "object") return null;
  const v = valor as Partial<Instantaneo>;
  if (typeof v.descricao !== "string" || typeof v.valorCentimos !== "number") return null;
  return v as Instantaneo;
}

function resumoLinha(linha: Instantaneo): string {
  return `${ROTULO_TIPO[linha.tipo] ?? linha.tipo} · "${linha.descricao}" · ${formatCentimos(linha.valorCentimos)} · ${linha.metodoPagamentoNome}`;
}

/** Only the fields that actually changed, each as "antes → depois". */
function diferencas(antes: Instantaneo, depois: Instantaneo): string[] {
  const mudancas: string[] = [];
  if (antes.tipo !== depois.tipo) {
    mudancas.push(`Tipo: ${ROTULO_TIPO[antes.tipo]} → ${ROTULO_TIPO[depois.tipo]}`);
  }
  if (antes.descricao !== depois.descricao) {
    mudancas.push(`Descrição: "${antes.descricao}" → "${depois.descricao}"`);
  }
  if (antes.valorCentimos !== depois.valorCentimos) {
    mudancas.push(
      `Valor: ${formatCentimos(antes.valorCentimos)} → ${formatCentimos(depois.valorCentimos)}`,
    );
  }
  if (antes.metodoPagamentoNome !== depois.metodoPagamentoNome) {
    mudancas.push(`Método: ${antes.metodoPagamentoNome} → ${depois.metodoPagamentoNome}`);
  }
  return mudancas;
}

function detalhes(entrada: Entrada): string[] {
  const antes = comoLinha(entrada.antes);
  const depois = comoLinha(entrada.depois);

  switch (entrada.acao) {
    case "LINHA_ADICIONADA":
      return depois ? [resumoLinha(depois)] : [];
    case "LINHA_APAGADA":
      return antes ? [resumoLinha(antes)] : [];
    case "LINHA_EDITADA":
      return antes && depois ? diferencas(antes, depois) : [];
    case "FINALIZADO": {
      const t = entrada.depois as { linhas?: number; vendas?: number; despesas?: number; saldo?: number } | null;
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
          {detalhes(entrada).map((texto) => (
            <p key={texto} className="mt-1 text-sm text-a-muted">
              {texto}
            </p>
          ))}
        </li>
      ))}
    </ol>
  );
}
