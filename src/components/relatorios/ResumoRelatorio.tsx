import { cn } from "@/lib/cn";
import {
  formatCentimos,
  formatCentimosNumero,
  quantidadeMilParaTexto,
} from "@/lib/relatorios/dinheiro";
import {
  ROTULO_CONTRAPARTE,
  ROTULO_TIPO,
  descontoDoRegisto,
  rotuloDescontoDaLinha,
  rotuloDescontoDoRegisto,
  rotuloIvaDaLinha,
  rotuloPagamento,
  totalDoRegisto,
  valorDaLinha,
  type LinhaVista,
  type RegistoVista,
  type Totais,
} from "@/lib/relatorios/resumo";

const badgeBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

/** A deleted report reads as deleted, whatever state it was deleted in. */
export function EstadoRelatorioBadge({ estado, apagado = false }: { estado: string; apagado?: boolean }) {
  const finalizado = estado === "FINALIZADO";
  return (
    <span
      className={cn(
        badgeBase,
        apagado ? "badge-danger" : finalizado ? "badge-success" : "badge-warm",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {apagado ? "Apagado" : finalizado ? "Finalizado" : "Rascunho"}
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
      <CartoesTotais totais={totais} nota={nota} />
      <TabelaPorMetodo totais={totais} />
    </section>
  );
}

/**
 * The three figures on their own, so the editor can keep them in sight above
 * the records instead of at the foot of a page that grows all day.
 */
export function CartoesTotais({ totais, nota }: { totais: Totais; nota?: string }) {
  const descontos = [
    totais.descontosVendas > 0 && `${formatCentimos(totais.descontosVendas)} nas vendas`,
    totais.descontosDespesas > 0 && `${formatCentimos(totais.descontosDespesas)} nas despesas`,
  ].filter(Boolean);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Cartao rotulo="Vendas" valor={totais.vendas} detalhe={`${totais.numVendas} linha(s)`} />
        <Cartao
          rotulo="Despesas"
          valor={totais.despesas}
          detalhe={`${totais.numDespesas} linha(s)`}
        />
        <Cartao rotulo="Saldo" valor={totais.saldo} detalhe="Vendas − despesas" destaque />
      </div>
      {/* Only when there is tax to report: a day of exempt lines should not
        carry a row of zeros around. */}
      {(totais.ivaVendas > 0 || totais.ivaDespesas > 0) && (
        <p className="text-xs text-a-faint">
          Inclui IVA de {formatCentimos(totais.ivaVendas)} nas vendas
          {totais.ivaDespesas > 0 && <> e {formatCentimos(totais.ivaDespesas)} nas despesas</>}.
        </p>
      )}
      {/* The totals are already net of them; this says how much was given. */}
      {descontos.length > 0 && (
        <p className="text-xs text-a-faint">Descontos de {descontos.join(" e ")}, já deduzidos.</p>
      )}
      {nota && <p className="text-xs text-a-faint">{nota}</p>}
    </div>
  );
}

export function TabelaPorMetodo({ totais }: { totais: Totais }) {
  return (
    <>
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
    </>
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
    <div className={cn("card-admin p-3 sm:p-4", destaque && "border-a-accent/30")}>
      <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-a-faint sm:text-xs">
        {rotulo}
        <span className="sm:hidden"> (Kz)</span>
      </p>
      <p
        className={cn(
          // The three sit side by side even on a phone — the day's figures are
          // read together — so the amount is the one that gives way: smaller,
          // and with the currency moved up to the label rather than wrapping.
          "mt-1 font-mono text-sm font-bold tabular-nums sm:text-lg",
          destaque && valor < 0 ? "text-rose-500" : "text-a-text",
        )}
      >
        <span className="sm:hidden">{formatCentimosNumero(valor)}</span>
        <span className="hidden sm:inline">{formatCentimos(valor)}</span>
      </p>
      <p className="mt-0.5 hidden text-xs text-a-muted sm:block">{detalhe}</p>
    </div>
  );
}

/** "2 × 85 000,00 Kz", with what the line says about its IVA and its discount. */
function calculoDaLinha(linha: LinhaVista): string {
  const partes = [
    `${quantidadeMilParaTexto(linha.quantidadeMil)} × ${formatCentimosNumero(linha.precoUnitarioCentimos)} Kz`,
    rotuloIvaDaLinha(linha),
    rotuloDescontoDaLinha(linha),
  ];
  return partes.filter(Boolean).join(" · ");
}

/**
 * The records as a reviewer reads them: each sale or expense with its client,
 * how it was paid and the articles under it.
 *
 * Laid out as rows rather than a table on purpose — a table of five columns
 * either scrolls sideways on a phone or shrinks the descriptions to nothing,
 * and this is the view a manager opens on a phone to check the day.
 */
export function TabelaRegistos({ registos }: { registos: readonly RegistoVista[] }) {
  if (registos.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-a-line-strong p-8 text-center text-sm text-a-muted">
        Sem vendas nem despesas registadas.
      </div>
    );
  }

  const ordenados = [...registos].sort((a, b) =>
    a.tipo === b.tipo ? 0 : a.tipo === "VENDA" ? -1 : 1,
  );

  return (
    <ul className="space-y-3">
      {ordenados.map((registo, indice) => {
        const total = totalDoRegisto(registo);
        const desconto = descontoDoRegisto(registo);
        const venda = registo.tipo === "VENDA";
        return (
          <li key={registo.id} className="card-admin overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-a-line px-4 py-3 sm:px-5">
              <span className="text-xs font-semibold text-a-faint">#{indice + 1}</span>
              <span className={cn(badgeBase, venda ? "badge-success" : "badge-danger")}>
                {ROTULO_TIPO[registo.tipo]}
              </span>
              <span className="min-w-0 truncate text-sm font-semibold text-a-text">
                {registo.clienteNome ?? (
                  <span className="font-normal text-a-faint">
                    Sem {ROTULO_CONTRAPARTE[registo.tipo].toLowerCase()}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "ml-auto font-mono text-base font-bold tabular-nums",
                  venda ? "text-a-text" : "text-rose-500",
                )}
              >
                {venda ? "" : "−"}
                {formatCentimos(total)}
              </span>
            </div>

            <ul className="divide-y divide-a-line">
              {registo.linhas.map((linha) => (
                <li key={linha.id} className="flex items-start gap-3 px-4 py-2.5 text-sm sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block text-a-text">{linha.descricao}</span>
                    <span className="mt-0.5 block text-xs text-a-muted">
                      {calculoDaLinha(linha)}
                      {linha.artigoCodigo ? ` · ${linha.artigoCodigo}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-a-text">
                    {formatCentimosNumero(valorDaLinha(linha))}
                  </span>
                </li>
              ))}
              {/* The bill's own discount, once, under the articles it came
                off — the header's total is what is left after it. */}
              {desconto > 0 && (
                <li className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
                  <span className="min-w-0 flex-1 text-a-muted">
                    {rotuloDescontoDoRegisto(registo)}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-a-muted">
                    −{formatCentimosNumero(desconto)}
                  </span>
                </li>
              )}
            </ul>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-a-line px-4 py-2.5 text-xs text-a-muted sm:px-5">
              <span>{rotuloPagamento(registo.pagamentos)}</span>
              {registo.clienteNif && <span>NIF {registo.clienteNif}</span>}
              {registo.facturaCodigo && <span>Documento {registo.facturaCodigo}</span>}
              {registo.nota && <span className="min-w-0 truncate italic">{registo.nota}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
