import { cn } from "@/lib/cn";
import { formatCentimos, formatCentimosNumero } from "@/lib/relatorios/dinheiro";
import { ROTULO_TIPO, type LinhaVista, type Totais } from "@/lib/relatorios/resumo";

const badgeBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

export function EstadoRelatorioBadge({ estado }: { estado: string }) {
  const finalizado = estado === "FINALIZADO";
  return (
    <span className={cn(badgeBase, finalizado ? "badge-success" : "badge-warm")}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {finalizado ? "Finalizado" : "Rascunho"}
    </span>
  );
}

/**
 * Sales, expenses and the balance, then the same split by payment method —
 * the breakdown is what gets reconciled against the till and the TPA slips.
 */
export function ResumoRelatorio({ totais, nota }: { totais: Totais; nota?: string }) {
  return (
    <section className="space-y-4" aria-label="Totais">
      <div className="grid gap-3 sm:grid-cols-3">
        <Cartao rotulo="Vendas" valor={totais.vendas} detalhe={`${totais.numVendas} linha(s)`} />
        <Cartao
          rotulo="Despesas"
          valor={totais.despesas}
          detalhe={`${totais.numDespesas} linha(s)`}
        />
        <Cartao rotulo="Saldo" valor={totais.saldo} detalhe="Vendas − despesas" destaque />
      </div>

      {nota && <p className="text-xs text-a-faint">{nota}</p>}

      {totais.porMetodo.length > 0 && (
        <div className="card-admin overflow-hidden">
          <h3 className="border-b border-a-line px-5 py-3 text-sm font-bold text-a-text">
            Por método de pagamento
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-md text-sm">
              <thead>
                <tr className="border-b border-a-line text-left text-xs uppercase tracking-wider text-a-faint">
                  <th className="px-5 py-2.5 font-semibold">Método</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Vendas (Kz)</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Despesas (Kz)</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Saldo (Kz)</th>
                </tr>
              </thead>
              <tbody className="table-rows">
                {totais.porMetodo.map((metodo) => (
                  <tr key={metodo.nome}>
                    <td className="px-5 py-2.5 font-medium text-a-text">{metodo.nome}</td>
                    <td className="px-5 py-2.5 text-right font-mono tabular-nums text-a-muted">
                      {formatCentimosNumero(metodo.vendas)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono tabular-nums text-a-muted">
                      {formatCentimosNumero(metodo.despesas)}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono font-semibold tabular-nums text-a-text">
                      {formatCentimosNumero(metodo.saldo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Cartao({
  rotulo,
  valor,
  detalhe,
  destaque = false,
}: {
  rotulo: string;
  valor: number;
  detalhe: string;
  destaque?: boolean;
}) {
  return (
    <div className={cn("card-admin p-4", destaque && "border-a-accent/30")}>
      <p className="text-xs font-semibold uppercase tracking-wider text-a-faint">{rotulo}</p>
      <p
        className={cn(
          "mt-1 font-mono text-lg font-bold tabular-nums",
          destaque && valor < 0 ? "text-rose-500" : "text-a-text",
        )}
      >
        {formatCentimos(valor)}
      </p>
      <p className="mt-0.5 text-xs text-a-muted">{detalhe}</p>
    </div>
  );
}

/** Read-only lines, sales first — for finalized reports and the admin view. */
export function TabelaLinhas({ linhas }: { linhas: readonly LinhaVista[] }) {
  if (linhas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-a-line-strong p-8 text-center text-sm text-a-muted">
        Sem vendas nem despesas registadas.
      </div>
    );
  }

  const ordenadas = [...linhas].sort((a, b) =>
    a.tipo === b.tipo ? 0 : a.tipo === "VENDA" ? -1 : 1,
  );

  return (
    <div className="card-admin overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-xl text-sm">
          <thead>
            <tr className="border-b border-a-line text-left text-xs uppercase tracking-wider text-a-faint">
              <th className="px-5 py-3 font-semibold">Tipo</th>
              <th className="px-5 py-3 font-semibold">Descrição</th>
              <th className="px-5 py-3 font-semibold">Método</th>
              <th className="px-5 py-3 text-right font-semibold">Valor (Kz)</th>
            </tr>
          </thead>
          <tbody className="table-rows">
            {ordenadas.map((linha) => (
              <tr key={linha.id}>
                <td className="px-5 py-3">
                  <span
                    className={cn(
                      badgeBase,
                      linha.tipo === "VENDA" ? "badge-success" : "badge-danger",
                    )}
                  >
                    {ROTULO_TIPO[linha.tipo]}
                  </span>
                </td>
                <td className="px-5 py-3 text-a-text">{linha.descricao}</td>
                <td className="px-5 py-3 text-a-muted">{linha.metodoPagamentoNome}</td>
                <td className="px-5 py-3 text-right font-mono tabular-nums text-a-text">
                  {linha.tipo === "DESPESA" ? "−" : ""}
                  {formatCentimosNumero(linha.valorCentimos)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
