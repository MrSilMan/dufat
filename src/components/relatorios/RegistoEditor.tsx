"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { AdminField, adminInputClass } from "@/components/admin/ui";
import { IconPlus } from "@/components/admin/icons";
import { CampoPesquisa } from "@/components/relatorios/CampoPesquisa";
import {
  formatCentimos,
  formatCentimosNumero,
  parseDesconto,
  taxaIvaParaTexto,
  type LinhaCalculada,
} from "@/lib/relatorios/dinheiro";
import { ROTULO_CONTRAPARTE, ROTULO_TIPO, type TipoLinha } from "@/lib/relatorios/resumo";
import { pesquisarArtigos, pesquisarClientes } from "@/server/actions/relatorios-catalogo";
import type { ArtigoEncontrado, ClienteEncontrado } from "@/lib/relatorios/catalogo";
import { TAXA_NORMAL, calcularEmEdicao } from "./tiposEditor";
import type { CamposLinha, CamposRegisto, EstadoRegisto, Metodo, Registo } from "./tiposEditor";

const TIPOS: TipoLinha[] = ["VENDA", "DESPESA"];

const ROTULO_ESTADO: Record<EstadoRegisto, { texto: string; cor: string }> = {
  novo: { texto: "Novo registo", cor: "text-a-faint" },
  guardado: { texto: "Guardado", cor: "text-emerald-600" },
  por_guardar: { texto: "Por guardar…", cor: "text-a-muted" },
  a_guardar: { texto: "A guardar…", cor: "text-a-muted" },
  incompleto: { texto: "Incompleto — não guardado", cor: "text-amber-600" },
  erro: { texto: "Não guardado", cor: "text-rose-500" },
  sem_ligacao: {
    texto: "Sem ligação — a tentar de novo",
    cor: "text-amber-600",
  },
  conflito: { texto: "Conflito", cor: "text-amber-600" },
};

/**
 * Whether the line came from an INVGEST document: a taxable price with the
 * document's own rate waiting to go on top of it. Everything else — typed by
 * hand, or picked from the catalog — is priced as paid, tax inside.
 */
function deDocumento(linha: CamposLinha): boolean {
  return linha.taxaIva > 0 && !linha.precoIncluiIva;
}

/**
 * Whether the price someone typed carries IVA or not, asked once per article.
 *
 * Neither side changes the line's total: the price typed is the price paid
 * either way. What it settles is how the report breaks that price up — how
 * much of the day's takings the relatório reports as tax.
 */
function EscolhaIva({
  linha,
  bloqueado,
  onEscolher,
}: {
  linha: CamposLinha;
  bloqueado: boolean;
  onEscolher: (taxaIva: number) => void;
}) {
  const opcoes: { taxa: number; rotulo: string }[] = [
    { taxa: TAXA_NORMAL, rotulo: `IVA ${taxaIvaParaTexto(TAXA_NORMAL)}` },
    { taxa: 0, rotulo: "Isento" },
  ];

  return (
    <div
      role="group"
      aria-label="IVA deste artigo"
      className="mt-1.5 flex justify-end gap-1"
    >
      {opcoes.map((opcao) => {
        const activa = linha.taxaIva === opcao.taxa;
        return (
          <button
            key={opcao.taxa}
            type="button"
            disabled={bloqueado}
            aria-pressed={activa}
            onClick={() => onEscolher(opcao.taxa)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40",
              activa
                ? "bg-a-accent/15 text-a-accent ring-1 ring-a-accent/30"
                : "text-a-faint hover:bg-a-surface-2 hover:text-a-text",
            )}
          >
            {opcao.rotulo}
          </button>
        );
      })}
    </div>
  );
}

/** What the record comes to on screen: its lines, both discounts taken. */
export function totalDoRegistoEmEdicao(campos: CamposRegisto): number {
  return calcularEmEdicao(campos).registo.total;
}

/**
 * What a discount field has to say about what is typed in it — the server's
 * complaint first, then text that is not a discount, then one larger than what
 * it comes off. Null when the discount is fine, or when there is none.
 */
function avisoDesconto(
  texto: string,
  limite: number | null,
  erro: string | undefined,
  maiorQue: string,
): string | null {
  if (erro) return erro;
  const lido = parseDesconto(texto);
  if (lido === "invalido") return "Escreva 10% ou um valor, ex.: 1 500,00";
  if (lido?.tipo === "VALOR" && limite !== null && lido.centimos > limite) return maiorQue;
  return null;
}

/** "+ Desconto" — how a discount field looks until someone wants one. */
function AbrirDesconto({
  rotulo,
  bloqueado,
  onAbrir,
}: {
  rotulo: string;
  bloqueado: boolean;
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      disabled={bloqueado}
      className="inline-flex min-h-9 items-center gap-1.5 text-xs font-medium text-a-muted transition-colors hover:text-a-text disabled:opacity-40"
    >
      <IconPlus className="h-3 w-3" />
      {rotulo}
    </button>
  );
}

/** The ✕ that takes a discount off again. */
function RemoverDesconto({
  rotulo,
  bloqueado,
  onRemover,
}: {
  rotulo: string;
  bloqueado: boolean;
  onRemover: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemover}
      disabled={bloqueado}
      title={`Remover ${rotulo}`}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xs text-a-faint transition-colors hover:bg-a-hover hover:text-rose-500 disabled:opacity-40 sm:h-8 sm:w-8"
    >
      <span aria-hidden>✕</span>
      <span className="sr-only">Remover {rotulo}</span>
    </button>
  );
}

/**
 * Shared by both discount inputs: compact, figures right-aligned like the
 * price, and still a 44px target on a phone, where this gets tapped.
 */
const campoDescontoClass =
  "w-32 min-h-11 px-3 py-2 text-right font-mono tabular-nums sm:min-h-9";

/**
 * An article's discount, typed either way — "10%" or an amount — with what it
 * came to written beside it, so "1.500" read as 1 500,00 Kz is seen to be read
 * that way before it is saved.
 */
function DescontoDoArtigo({
  id,
  valor,
  precos,
  comIva,
  erro,
  bloqueado,
  onEscrever,
  onBlur,
  onRemover,
}: {
  id: string;
  valor: string;
  /** The line priced, or undefined while its quantity or price does not read. */
  precos: LinhaCalculada | undefined;
  /** The price is taxable, so the discount took the IVA on it along. */
  comIva: boolean;
  erro: string | undefined;
  bloqueado: boolean;
  onEscrever: (texto: string) => void;
  onBlur: () => void;
  onRemover: () => void;
}) {
  const aviso = avisoDesconto(
    valor,
    precos?.bruto ?? null,
    erro,
    "Maior do que o valor do artigo",
  );
  const lido = parseDesconto(valor);

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <label htmlFor={id} className="text-xs font-medium text-a-muted">
        Desconto
      </label>
      <input
        id={id}
        value={valor}
        maxLength={32}
        autoComplete="off"
        disabled={bloqueado}
        onChange={(evento) => onEscrever(evento.target.value)}
        onBlur={onBlur}
        aria-invalid={aviso ? true : undefined}
        aria-describedby={`${id}-ajuda`}
        className={cn(adminInputClass, campoDescontoClass, aviso && "border-rose-500/60")}
        placeholder="10% ou 500"
      />
      <span
        id={`${id}-ajuda`}
        className={cn(
          "text-xs",
          aviso ? "text-rose-500" : "font-mono tabular-nums text-a-muted",
        )}
      >
        {aviso ??
          (lido && precos
            ? `−${formatCentimos(precos.descontoLinha)}${comIva ? " com IVA" : ""}`
            : null)}
      </span>
      <RemoverDesconto rotulo="o desconto do artigo" bloqueado={bloqueado} onRemover={onRemover} />
    </div>
  );
}

/**
 * The bill, once it has a discount: what the articles came to, the discount on
 * the whole of it, and what was paid. Without a discount there is nothing here
 * the card's header does not already say.
 */
function ContaDoRegisto({
  id,
  valor,
  subtotal,
  desconto,
  total,
  erro,
  bloqueado,
  onEscrever,
  onBlur,
  onRemover,
}: {
  id: string;
  valor: string;
  subtotal: number;
  desconto: number;
  total: number;
  erro: string | undefined;
  bloqueado: boolean;
  onEscrever: (texto: string) => void;
  onBlur: () => void;
  onRemover: () => void;
}) {
  const aviso = avisoDesconto(valor, subtotal, erro, "Maior do que o total do registo");
  const lido = parseDesconto(valor);

  return (
    <div className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-xl border border-a-line bg-a-surface-2/40 px-3.5 py-3 text-sm sm:ml-auto sm:w-auto sm:min-w-[22rem]">
      <span className="text-a-muted">Subtotal</span>
      <span className="text-right font-mono tabular-nums text-a-text">
        {formatCentimos(subtotal)}
      </span>

      <label htmlFor={id} className="text-a-muted">
        Desconto no total
      </label>
      <span className="flex items-center justify-end gap-1">
        <input
          id={id}
          value={valor}
          maxLength={32}
          autoComplete="off"
          disabled={bloqueado}
          onChange={(evento) => onEscrever(evento.target.value)}
          onBlur={onBlur}
          aria-invalid={aviso ? true : undefined}
          aria-describedby={`${id}-ajuda`}
          className={cn(adminInputClass, campoDescontoClass, aviso && "border-rose-500/60")}
          placeholder="10% ou 500"
        />
        <RemoverDesconto
          rotulo="o desconto no total"
          bloqueado={bloqueado}
          onRemover={onRemover}
        />
      </span>
      {(aviso || lido) && (
        <span
          id={`${id}-ajuda`}
          className={cn(
            "col-span-2 text-right text-xs",
            aviso ? "text-rose-500" : "font-mono tabular-nums text-a-muted",
          )}
        >
          {aviso ?? `−${formatCentimos(desconto)}`}
        </span>
      )}

      <span className="mt-1 border-t border-a-line pt-2 font-semibold text-a-text">Total</span>
      <span className="mt-1 border-t border-a-line pt-2 text-right font-mono font-semibold tabular-nums text-a-text">
        {formatCentimos(total)}
      </span>
    </div>
  );
}

type Props = {
  registo: Registo;
  metodos: Metodo[];
  nomes: Map<string, string>;
  bloqueado: boolean;
  numero: number;
  /** Open shows the whole form; closed, a one-line summary of the record. */
  aberto: boolean;
  /** Open and staying open: a record waiting on a decision cannot be minimized. */
  fixo: boolean;
  onAlternar: () => void;
  onEditar: (patch: Partial<CamposRegisto>, atraso?: number) => void;
  onEditarLinha: (linhaId: string, patch: Partial<CamposLinha>, atraso?: number) => void;
  onAdicionarLinha: () => void;
  onRemoverLinha: (linhaId: string) => void;
  onBlur: () => void;
  onApagar: () => void;
  onTentar: () => void;
  onUsarGuardado: () => void;
  onManterMeu: () => void;
};

/**
 * One sale or expense: who it was for, how it was paid, and its articles.
 *
 * The card is the shape the work actually has — a customer buys three things
 * and pays once — so the client and the payment method are asked once, at the
 * top, and the articles are the repeated part underneath.
 *
 * A finished record folds back into its header line: by the end of a busy day
 * the list is what has to stay readable, not twenty open forms.
 */
export function RegistoEditor({
  registo,
  metodos,
  nomes,
  bloqueado,
  numero,
  aberto,
  fixo,
  onAlternar,
  onEditar,
  onEditarLinha,
  onAdicionarLinha,
  onRemoverLinha,
  onBlur,
  onApagar,
  onTentar,
  onUsarGuardado,
  onManterMeu,
}: Props) {
  const { campos, estado } = registo;
  const rotulo = ROTULO_ESTADO[estado];
  const venda = campos.tipo === "VENDA";
  const metodoRetirado = campos.metodoPagamentoId !== "" && !nomes.has(campos.metodoPagamentoId);
  const calculo = calcularEmEdicao(campos);
  const total = calculo.registo.total;

  // Discount fields someone opened and has not typed in yet. One with a value
  // stays open on its own; an empty one folds back into its link on blur.
  const [descontosAbertos, setDescontosAbertos] = useState<ReadonlySet<string>>(new Set());
  const [contaAberta, setContaAberta] = useState(false);
  const descontoVisivel = (linha: CamposLinha) =>
    linha.desconto !== "" || descontosAbertos.has(linha.id);
  const contaVisivel = campos.desconto !== "" || contaAberta;
  const alternarDesconto = (linhaId: string, aberto: boolean) =>
    setDescontosAbertos((atuais) => {
      const proximos = new Set(atuais);
      if (aberto) proximos.add(linhaId);
      else proximos.delete(linhaId);
      return proximos;
    });
  const focar = (id: string) =>
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  const erroLinha = (linhaId: string, campo: string) =>
    registo.errors?.[`linhas.${linhaId}.${campo}`];
  const metodoNome =
    nomes.get(campos.metodoPagamentoId) ?? registo.base?.metodoPagamentoNome ?? null;
  const corpoId = `corpo-${registo.id}`;

  const valor = (
    <span
      className={cn(
        "font-mono text-sm font-bold tabular-nums sm:text-base",
        venda ? "text-a-text" : "text-rose-500",
      )}
    >
      {venda ? "" : "−"}
      {formatCentimos(total)}
    </span>
  );

  const apagar = (
    <button
      type="button"
      onClick={onApagar}
      disabled={bloqueado || estado === "a_guardar"}
      className="btn-row-danger min-h-9 px-3 text-xs disabled:opacity-40"
    >
      Apagar
    </button>
  );

  const seta = (
    <span
      aria-hidden
      className={cn(
        "shrink-0 text-xs text-a-faint transition-transform",
        aberto ? "rotate-90" : "",
      )}
    >
      ▶
    </span>
  );

  return (
    <li
      id={`registo-${registo.id}`}
      className={cn(
        // No `overflow-hidden`: the search suggestions hang out of the card,
        // and clipping them cuts the last result in half. Nothing inside
        // paints to the card's edges, so the rounded corners hold without it.
        "card-admin",
        estado === "conflito" && "border-amber-500/50",
        estado === "erro" && "border-rose-500/40",
      )}
    >
      {aberto ? (
        /* Header: what kind of record this is, and what it comes to. */
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-a-line px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onAlternar}
            disabled={fixo}
            aria-expanded
            aria-controls={corpoId}
            title={fixo ? "Resolva este registo para o poder minimizar" : "Minimizar registo"}
            className="flex min-h-9 items-center gap-2 text-xs font-semibold text-a-faint transition-colors hover:text-a-text disabled:opacity-40 disabled:hover:text-a-faint"
          >
            {seta}#{numero}
            <span className="sr-only">Minimizar registo {numero}</span>
          </button>

          <div
            role="radiogroup"
            aria-label="Tipo de registo"
            className="inline-flex rounded-full border border-a-line p-0.5"
          >
            {TIPOS.map((tipo) => {
              const ativo = campos.tipo === tipo;
              return (
                <button
                  key={tipo}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  disabled={bloqueado}
                  onClick={() => onEditar({ tipo }, 0)}
                  className={cn(
                    "min-h-9 rounded-full px-3.5 text-xs font-semibold transition-colors",
                    ativo
                      ? tipo === "VENDA"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-rose-500/15 text-rose-500"
                      : "text-a-muted hover:text-a-text",
                  )}
                >
                  {ROTULO_TIPO[tipo]}
                </button>
              );
            })}
          </div>

          <span className={cn("text-xs font-medium", rotulo.cor)}>{rotulo.texto}</span>

          <div className="ml-auto flex items-center gap-3">
            {valor}
            {apagar}
          </div>
        </div>
      ) : (
        /* Closed: the line a person scans down — who, how much, how paid.
           On a phone it takes two lines, so the client's name gets the width
           instead of losing it to the amount and a button. */
        <div className="flex items-center gap-3 px-3 py-2.5 sm:px-5 sm:py-3">
          <button
            type="button"
            onClick={onAlternar}
            aria-expanded={false}
            aria-controls={corpoId}
            className="flex min-h-11 min-w-0 flex-1 flex-col gap-0.5 text-left sm:min-h-9 sm:flex-row sm:items-center sm:gap-3"
          >
            <span className="flex min-w-0 items-center gap-2">
              {seta}
              <span className="text-xs font-semibold text-a-faint">#{numero}</span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                  venda ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-500",
                )}
              >
                {ROTULO_TIPO[campos.tipo]}
              </span>
              <span className="min-w-0 truncate text-sm font-semibold text-a-text">
                {campos.clienteNome.trim() || (
                  <span className="font-normal text-a-faint">
                    Sem {ROTULO_CONTRAPARTE[campos.tipo].toLowerCase()}
                  </span>
                )}
              </span>
            </span>
            <span className="flex items-baseline justify-between gap-3 pl-6 sm:ml-auto sm:pl-0">
              <span className="min-w-0 truncate text-xs text-a-muted">
                {campos.linhas.length} artigo(s)
                {metodoNome ? ` · ${metodoNome}` : ""}
                {estado !== "guardado" && (
                  <span className={cn("font-medium", rotulo.cor)}> · {rotulo.texto}</span>
                )}
              </span>
              <span className="shrink-0 sm:hidden">{valor}</span>
            </span>
          </button>
          {/* From a tablet up there is room for the amount and the button
              beside the line; on a phone, deleting is a reason to open it. */}
          <div className="hidden shrink-0 items-center gap-3 sm:flex">
            {valor}
            {apagar}
          </div>
        </div>
      )}

      {/* Unmounted when closed: the editor holds every field, so a closed card
          has nothing of its own to lose, and a long day stays light. */}
      {aberto && (
        <div id={corpoId} className="space-y-4 p-4 sm:p-5">
          {/* Who and how — asked once for the whole record. */}
          <div className="grid gap-3 md:grid-cols-2">
            <AdminField
              label={ROTULO_CONTRAPARTE[campos.tipo]}
              htmlFor={`cliente-${registo.id}`}
              optional
              errors={registo.errors?.clienteNome}
            >
              <CampoPesquisa<ClienteEncontrado>
                id={`cliente-${registo.id}`}
                valor={campos.clienteNome}
                disabled={bloqueado}
                maxLength={160}
                placeholder={venda ? "Procurar ou escrever o cliente…" : "A quem foi pago…"}
                onEscrever={(texto) =>
                  // Typing over a picked client unlinks it: the name is now the
                  // colaborador's, and keeping the id would credit the sale to a
                  // client nobody chose.
                  onEscrever(texto, campos, onEditar)
                }
                onEscolher={(cliente) =>
                  onEditar(
                    {
                      clienteNome: cliente.nome,
                      clienteNif: cliente.nif ?? "",
                      clienteInvgestId: cliente.invgestId,
                    },
                    0,
                  )
                }
                onBlur={onBlur}
                procurar={pesquisarClientes}
                sugestao={(cliente) => ({
                  chave: cliente.invgestId,
                  principal: cliente.nome,
                  secundario: cliente.nif ? `NIF ${cliente.nif}` : null,
                })}
                ajuda={
                  campos.clienteInvgestId ? (
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-emerald-600">
                      <span aria-hidden>✓</span> Cliente INVGEST
                      {campos.clienteNif ? ` · NIF ${campos.clienteNif}` : ""}
                    </p>
                  ) : null
                }
              />
            </AdminField>

            <AdminField
              label="Método de pagamento"
              htmlFor={`metodo-${registo.id}`}
              errors={registo.errors?.metodoPagamentoId}
            >
              <select
                id={`metodo-${registo.id}`}
                value={campos.metodoPagamentoId}
                disabled={bloqueado}
                onChange={(evento) => onEditar({ metodoPagamentoId: evento.target.value }, 0)}
                className={adminInputClass}
              >
                <option value="" disabled>
                  Escolher…
                </option>
                {metodos.map((metodo) => (
                  <option key={metodo.id} value={metodo.id}>
                    {metodo.nome}
                  </option>
                ))}
                {metodoRetirado && (
                  <option value={campos.metodoPagamentoId}>
                    {registo.base?.metodoPagamentoNome ?? "Método"} (desativado)
                  </option>
                )}
              </select>
            </AdminField>
          </div>

          {campos.facturaCodigo && (
            <p className="flex flex-wrap items-center gap-2 rounded-xl border border-a-line bg-a-surface-2/60 px-3.5 py-2 text-xs text-a-muted">
              <span className="font-semibold text-a-text">
                Documento INVGEST {campos.facturaCodigo}
              </span>
              <button
                type="button"
                disabled={bloqueado}
                onClick={() => onEditar({ facturaCodigo: "", facturaInvgestId: "" }, 0)}
                className="text-a-faint underline-offset-2 transition-colors hover:text-rose-500 hover:underline"
              >
                desassociar
              </button>
            </p>
          )}

          {/* The articles. */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-a-faint">
                Artigos ({campos.linhas.length})
              </h3>
              {registo.errors?.linhas?.[0] && (
                <p role="alert" className="text-xs text-rose-500">
                  {registo.errors.linhas[0]}
                </p>
              )}
            </div>

            <ul className="space-y-2.5">
              {campos.linhas.map((linha, indice) => (
                <li
                  key={linha.id}
                  className="rounded-xl border border-a-line bg-a-surface-2/40 p-3 sm:p-3.5"
                >
                  {/* On a phone the description takes the full width and the
                    two numbers sit side by side under it — stacking all four
                    fields makes a three-article sale a page and a half of
                    scrolling. On a desktop they are one row. */}
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_5.5rem_9rem_auto] lg:items-start">
                    <AdminField
                      label="Artigo / descrição"
                      htmlFor={`descricao-${linha.id}`}
                      errors={erroLinha(linha.id, "descricao")}
                      className="col-span-2 lg:col-span-1"
                    >
                      <CampoPesquisa<ArtigoEncontrado>
                        id={`descricao-${linha.id}`}
                        valor={linha.descricao}
                        disabled={bloqueado}
                        placeholder={
                          venda ? "Procurar no catálogo…" : "Ex.: combustível da carrinha"
                        }
                        onEscrever={(texto) =>
                          onEditarLinha(linha.id, {
                            descricao: texto,
                            // Retyping the description detaches the catalog
                            // article: the line is now free text.
                            artigoInvgestId: "",
                            artigoCodigo: "",
                          })
                        }
                        onEscolher={(artigo) =>
                          onEditarLinha(
                            linha.id,
                            {
                              descricao: artigo.descricao,
                              artigoInvgestId: artigo.invgestItemId ?? "",
                              artigoCodigo: artigo.codigo ?? "",
                              // A catalog article with no price keeps whatever
                              // was typed: 0,00 is not a price, it is a gap.
                              // A catalog price is the price paid, tax inside,
                              // which is the opposite of how a document line
                              // arrived — so the rate moves inside the price.
                              ...(artigo.precoCentimos > 0
                                ? {
                                    precoUnitario: centimosParaCampo(artigo.precoCentimos),
                                    taxaIva: artigo.taxaIvaCentesimos,
                                    precoIncluiIva: true,
                                  }
                                : {}),
                            },
                            0,
                          )
                        }
                        onBlur={onBlur}
                        procurar={pesquisarArtigos}
                        sugestao={(artigo) => ({
                          chave: artigo.chave,
                          principal: artigo.descricao,
                          secundario: artigo.codigo,
                          extra:
                            artigo.precoCentimos > 0
                              ? `${formatCentimosNumero(artigo.precoCentimos)} Kz`
                              : null,
                          etiqueta: artigo.origem === "local" ? "local" : null,
                        })}
                        ajuda={
                          linha.artigoCodigo ? (
                            <p className="mt-1.5 truncate text-xs text-a-faint">
                              Artigo {linha.artigoCodigo}
                            </p>
                          ) : null
                        }
                      />
                    </AdminField>

                    <AdminField
                      label="Qtd."
                      htmlFor={`quantidade-${linha.id}`}
                      errors={erroLinha(linha.id, "quantidade")}
                    >
                      <input
                        id={`quantidade-${linha.id}`}
                        value={linha.quantidade}
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={bloqueado}
                        onChange={(evento) =>
                          onEditarLinha(linha.id, {
                            quantidade: evento.target.value,
                          })
                        }
                        onBlur={onBlur}
                        className={cn(adminInputClass, "text-right font-mono tabular-nums")}
                        placeholder="1"
                      />
                    </AdminField>

                    <AdminField
                      label={
                        deDocumento(linha) ? "Preço unit. s/ IVA" : "Preço unit. (Kz)"
                      }
                      htmlFor={`preco-${linha.id}`}
                      errors={erroLinha(linha.id, "precoUnitario")}
                    >
                      <input
                        id={`preco-${linha.id}`}
                        value={linha.precoUnitario}
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={bloqueado}
                        onChange={(evento) =>
                          onEditarLinha(linha.id, {
                            precoUnitario: evento.target.value,
                          })
                        }
                        onBlur={onBlur}
                        className={cn(adminInputClass, "text-right font-mono tabular-nums")}
                        placeholder="0,00"
                      />
                      {deDocumento(linha) ? (
                        // A document states a taxable price and its own rate;
                        // neither is ours to reinterpret, so it is shown, not
                        // offered.
                        <p className="mt-1.5 text-right text-xs text-a-faint">
                          + IVA {taxaIvaParaTexto(linha.taxaIva)} · do documento
                        </p>
                      ) : (
                        <EscolhaIva
                          linha={linha}
                          bloqueado={bloqueado}
                          onEscolher={(taxaIva) =>
                            // Both sides keep the price inclusive, so choosing
                            // never moves the total — only how it is broken up.
                            onEditarLinha(linha.id, { taxaIva, precoIncluiIva: true })
                          }
                        />
                      )}
                    </AdminField>

                    {/* The line's own total, labelled like the fields beside it
                      so the column reads as part of the same row. */}
                    <div className="col-span-2 flex items-center justify-between gap-3 lg:col-span-1 lg:flex-col lg:items-end lg:justify-start lg:gap-0">
                      <span className="text-sm font-medium text-a-text lg:mb-1.5">Total</span>
                      <span className="font-mono text-sm font-semibold tabular-nums text-a-text lg:flex lg:min-h-11 lg:min-w-24 lg:items-center lg:justify-end">
                        {/* After the article's own discount; the bill's is
                          shown once, under the articles, as a bill does. */}
                        {calculo.porId.has(linha.id)
                          ? formatCentimosNumero(
                              calculo.porId.get(linha.id)!.total +
                                calculo.porId.get(linha.id)!.descontoRegisto,
                            )
                          : "—"}
                      </span>
                      <button
                        type="button"
                        disabled={bloqueado || campos.linhas.length === 1}
                        onClick={() => onRemoverLinha(linha.id)}
                        title={
                          campos.linhas.length === 1
                            ? "Um registo tem de ter pelo menos um artigo"
                            : "Remover artigo"
                        }
                        className="btn-row-danger min-h-9 shrink-0 whitespace-nowrap px-3 text-xs disabled:opacity-30 lg:mt-1"
                      >
                        <span aria-hidden className="lg:hidden">
                          Remover
                        </span>
                        <span aria-hidden className="hidden lg:inline">
                          ✕
                        </span>
                        <span className="sr-only">Remover artigo {indice + 1}</span>
                      </button>
                    </div>
                  </div>

                  {/* The article's own discount: a link until it is wanted —
                    most sales have none, and an empty box under every
                    article would be noise. */}
                  {descontoVisivel(linha) ? (
                    <DescontoDoArtigo
                      id={`desconto-${linha.id}`}
                      valor={linha.desconto}
                      precos={calculo.porId.get(linha.id)}
                      comIva={deDocumento(linha)}
                      erro={erroLinha(linha.id, "desconto")?.[0]}
                      bloqueado={bloqueado}
                      onEscrever={(texto) => onEditarLinha(linha.id, { desconto: texto })}
                      onBlur={() => {
                        onBlur();
                        if (!linha.desconto.trim()) alternarDesconto(linha.id, false);
                      }}
                      onRemover={() => {
                        onEditarLinha(linha.id, { desconto: "" }, 0);
                        alternarDesconto(linha.id, false);
                      }}
                    />
                  ) : (
                    <div className="mt-1">
                      <AbrirDesconto
                        rotulo="Desconto"
                        bloqueado={bloqueado}
                        onAbrir={() => {
                          alternarDesconto(linha.id, true);
                          focar(`desconto-${linha.id}`);
                        }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-start justify-between gap-3">
              <button
                type="button"
                onClick={onAdicionarLinha}
                disabled={bloqueado}
                className="btn-admin-ghost min-h-10 w-full text-xs sm:w-auto"
              >
                <IconPlus className="h-3.5 w-3.5" />
                Adicionar artigo
              </button>

              {contaVisivel ? (
                <ContaDoRegisto
                  id={`desconto-registo-${registo.id}`}
                  valor={campos.desconto}
                  subtotal={calculo.registo.subtotal}
                  desconto={calculo.registo.desconto}
                  total={calculo.registo.total}
                  erro={registo.errors?.desconto?.[0]}
                  bloqueado={bloqueado}
                  onEscrever={(texto) => onEditar({ desconto: texto })}
                  onBlur={() => {
                    onBlur();
                    if (!campos.desconto.trim()) setContaAberta(false);
                  }}
                  onRemover={() => {
                    onEditar({ desconto: "" }, 0);
                    setContaAberta(false);
                  }}
                />
              ) : (
                <AbrirDesconto
                  rotulo="Desconto no total"
                  bloqueado={bloqueado}
                  onAbrir={() => {
                    setContaAberta(true);
                    focar(`desconto-registo-${registo.id}`);
                  }}
                />
              )}
            </div>
          </div>

          <details className="group">
            <summary className="cursor-pointer list-none text-xs font-medium text-a-muted transition-colors hover:text-a-text [&::-webkit-details-marker]:hidden">
              Nota
              <span aria-hidden className="ml-1 text-[0.6rem] opacity-70 group-open:hidden">
                ▾
              </span>
            </summary>
            <input
              id={`nota-${registo.id}`}
              value={campos.nota}
              maxLength={300}
              disabled={bloqueado}
              autoComplete="off"
              onChange={(evento) => onEditar({ nota: evento.target.value })}
              onBlur={onBlur}
              className={cn(adminInputClass, "mt-2")}
              placeholder="Algo a recordar sobre este registo (opcional)"
              aria-label="Nota do registo"
            />
          </details>

          {estado === "erro" && registo.mensagem && (
            <div className="flex flex-wrap items-center gap-3">
              <p role="alert" className="text-sm text-rose-500">
                {registo.mensagem}
              </p>
              {!registo.errors && (
                <button
                  type="button"
                  onClick={onTentar}
                  className="btn-admin-ghost min-h-9 text-xs"
                >
                  Tentar de novo
                </button>
              )}
            </div>
          )}

          {estado === "conflito" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-a-text">
              <p className="font-semibold">{registo.mensagem}</p>
              {registo.atual && (
                <p className="mt-1 text-a-muted">
                  Versão guardada: {ROTULO_TIPO[registo.atual.tipo]}
                  {registo.atual.clienteNome ? ` · ${registo.atual.clienteNome}` : ""} ·{" "}
                  {registo.atual.linhas.length} artigo(s) ·{" "}
                  {formatCentimos(
                    registo.atual.linhas.reduce((soma, linha) => soma + linha.valorCentimos, 0),
                  )}{" "}
                  · {registo.atual.metodoPagamentoNome}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onUsarGuardado}
                  className="btn-admin-ghost min-h-9 text-xs"
                >
                  {registo.atual ? "Usar a versão guardada" : "Descartar este registo"}
                </button>
                <button
                  type="button"
                  onClick={onManterMeu}
                  disabled={bloqueado}
                  className="btn-admin min-h-9 text-xs"
                >
                  {registo.atual ? "Manter o meu" : "Guardar de novo"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** 8500000 → "85000,00", the form an amount input holds. */
function centimosParaCampo(centimos: number): string {
  return `${Math.floor(centimos / 100)},${String(centimos % 100).padStart(2, "0")}`;
}

/**
 * Typing over a picked client keeps the text and drops the link to INVGEST —
 * including the NIF, which belonged to the client that was picked.
 */
function onEscrever(
  texto: string,
  campos: CamposRegisto,
  onEditar: (patch: Partial<CamposRegisto>, atraso?: number) => void,
): void {
  if (campos.clienteInvgestId) {
    onEditar({ clienteNome: texto, clienteInvgestId: "", clienteNif: "" });
  } else {
    onEditar({ clienteNome: texto });
  }
}
