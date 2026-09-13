import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { formatCentimosNumero } from "@/lib/relatorios/dinheiro";
import { formatDataHoraLuanda, rotuloDia } from "@/lib/relatorios/dia";
import { ROTULO_TIPO, calcularTotais, type LinhaVista } from "@/lib/relatorios/resumo";
import { carregarRelatorio } from "@/lib/relatorios/queries";
import { acessoRelatorios, podeVerRelatorio } from "@/lib/relatorios/acesso";
import { BotaoImprimir } from "@/components/premios/BotaoImprimir";

export const metadata: Metadata = { title: "Relatório diário — impressão", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * A daily report laid out for A4; the browser's "Save as PDF" produces the
 * download, as with the ranking and the spec sheets.
 *
 * A draft can be printed by the admin reviewing it, so the state is printed
 * prominently — a draft on paper must never pass for a closed report.
 */
export default async function ImprimirRelatorioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession("/equipa/entrar");
  const { id } = await params;

  const [relatorio, acesso, settings] = await Promise.all([
    carregarRelatorio(id),
    acessoRelatorios(session),
    getSiteSettings(),
  ]);
  if (!relatorio || !podeVerRelatorio(session, acesso, relatorio.autorId)) notFound();

  const totais = calcularTotais(relatorio.linhas);
  const vendas = relatorio.linhas.filter((l) => l.tipo === "VENDA");
  const despesas = relatorio.linhas.filter((l) => l.tipo === "DESPESA");
  const finalizado = relatorio.estado === "FINALIZADO";

  return (
    <>
      <div className="no-print mx-auto flex max-w-[210mm] items-center justify-between gap-4 px-6 py-4">
        <p className="text-sm text-ink-soft">
          Relatório de {relatorio.autorNome} — {rotuloDia(relatorio.dia)}
        </p>
        <BotaoImprimir label="Guardar como PDF" />
      </div>

      <main className="folha-a4">
        <header className="mb-6 flex items-end justify-between gap-6 border-b-2 border-dufat pb-4">
          <div>
            <p className="text-[7pt] font-bold uppercase tracking-[0.28em] text-lumen-deep">
              {settings.footerTagline ?? "DUFAT, Lda."}
            </p>
            <h1 className="mt-1 font-display text-[20pt] font-black leading-tight text-ink">
              Relatório diário de vendas e despesas
            </h1>
            <p className="mt-1 text-[10pt] text-ink-soft">
              {rotuloDia(relatorio.dia)} · {relatorio.autorNome}
            </p>
          </div>
          <div className="shrink-0 text-right text-[8pt] whitespace-nowrap text-ink-soft">
            <p className="text-[10pt] font-bold text-ink">
              {finalizado ? "Finalizado" : "RASCUNHO — não finalizado"}
            </p>
            {relatorio.finalizadoEm && (
              <p className="mt-0.5">em {formatDataHoraLuanda(relatorio.finalizadoEm)}</p>
            )}
            <p className="mt-0.5">Versão {relatorio.versao}</p>
            <p className="mt-0.5">Impresso em {formatDataHoraLuanda(new Date())}</p>
          </div>
        </header>

        <Seccao titulo="Vendas" linhas={vendas} total={totais.vendas} />
        <Seccao titulo="Despesas" linhas={despesas} total={totais.despesas} />

        <section className="mt-6">
          <h2 className="mb-2 font-display text-[11pt] font-bold text-ink">Totais</h2>
          <table>
            <tbody>
              <tr>
                <td>Total de vendas</td>
                <td className="num">{formatCentimosNumero(totais.vendas)} Kz</td>
              </tr>
              <tr>
                <td>Total de despesas</td>
                <td className="num">{formatCentimosNumero(totais.despesas)} Kz</td>
              </tr>
              <tr>
                <td>
                  <strong>Saldo</strong>
                </td>
                <td className="num">
                  <strong>{formatCentimosNumero(totais.saldo)} Kz</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mt-6">
          <h2 className="mb-2 font-display text-[11pt] font-bold text-ink">
            Por método de pagamento
          </h2>
          {totais.porMetodo.length === 0 ? (
            <p className="text-[8.5pt] text-ink-soft">Sem movimentos.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Método</th>
                  <th className="num">Vendas (Kz)</th>
                  <th className="num">Despesas (Kz)</th>
                  <th className="num">Saldo (Kz)</th>
                </tr>
              </thead>
              <tbody>
                {totais.porMetodo.map((metodo) => (
                  <tr key={metodo.nome}>
                    <td>{metodo.nome}</td>
                    <td className="num">{formatCentimosNumero(metodo.vendas)}</td>
                    <td className="num">{formatCentimosNumero(metodo.despesas)}</td>
                    <td className="num">{formatCentimosNumero(metodo.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}

function Seccao({
  titulo,
  linhas,
  total,
}: {
  titulo: string;
  linhas: LinhaVista[];
  total: number;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-2 font-display text-[11pt] font-bold text-ink">
        {titulo} ({linhas.length})
      </h2>
      {linhas.length === 0 ? (
        <p className="text-[8.5pt] text-ink-soft">Sem {titulo.toLowerCase()} registadas.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Descrição</th>
              <th>Método</th>
              <th className="num">Valor (Kz)</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.id}>
                <td>{linha.descricao}</td>
                <td>{linha.metodoPagamentoNome}</td>
                <td className="num">{formatCentimosNumero(linha.valorCentimos)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2}>
                <strong>Total de {ROTULO_TIPO[linhas[0]!.tipo].toLowerCase()}s</strong>
              </td>
              <td className="num">
                <strong>{formatCentimosNumero(total)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </section>
  );
}
