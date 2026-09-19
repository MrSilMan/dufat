"use client";

import { cn } from "@/lib/cn";
import { AdminField, adminInputClass } from "@/components/admin/ui";
import { IconPlus } from "@/components/admin/icons";
import { CampoPesquisa } from "@/components/relatorios/CampoPesquisa";
import {
  formatCentimos,
  formatCentimosNumero,
  parseQuantidadeMil,
  parseValorCentimos,
  taxaIvaParaTexto,
  totalDaLinha,
} from "@/lib/relatorios/dinheiro";
import { ROTULO_CONTRAPARTE, ROTULO_TIPO, type TipoLinha } from "@/lib/relatorios/resumo";
import { pesquisarArtigos, pesquisarClientes } from "@/server/actions/relatorios-catalogo";
import type { ArtigoEncontrado, ClienteEncontrado } from "@/lib/relatorios/catalogo";
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

/** The line's own total, IVA included — "—" while either field is unreadable. */
function totalDaLinhaTexto(linha: CamposLinha): string {
  const quantidade = parseQuantidadeMil(linha.quantidade);
  const preco = parseValorCentimos(linha.precoUnitario);
  if (quantidade === null || preco === null) return "—";
  return formatCentimosNumero(totalDaLinha(quantidade, preco, linha.taxaIva));
}

export function totalDoRegistoEmEdicao(campos: CamposRegisto): number {
  return campos.linhas.reduce((soma, linha) => {
    const quantidade = parseQuantidadeMil(linha.quantidade);
    const preco = parseValorCentimos(linha.precoUnitario);
    if (quantidade === null || preco === null) return soma;
    return soma + totalDaLinha(quantidade, preco, linha.taxaIva);
  }, 0);
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
  const total = totalDoRegistoEmEdicao(campos);
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
        "card-admin overflow-hidden",
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
                              // A catalog price already includes IVA, so taking
                              // one drops the rate a document line came with.
                              ...(artigo.precoCentimos > 0
                                ? {
                                    precoUnitario: centimosParaCampo(artigo.precoCentimos),
                                    taxaIva: 0,
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
                      label={linha.taxaIva > 0 ? "Preço unit. s/ IVA" : "Preço unit. (Kz)"}
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
                      {linha.taxaIva > 0 && (
                        <p className="mt-1.5 text-right text-xs text-a-faint">
                          + IVA {taxaIvaParaTexto(linha.taxaIva)}
                        </p>
                      )}
                    </AdminField>

                    {/* The line's own total, labelled like the fields beside it
                      so the column reads as part of the same row. */}
                    <div className="col-span-2 flex items-center justify-between gap-3 lg:col-span-1 lg:flex-col lg:items-end lg:justify-start lg:gap-0">
                      <span className="text-sm font-medium text-a-text lg:mb-1.5">Total</span>
                      <span className="font-mono text-sm font-semibold tabular-nums text-a-text lg:flex lg:min-h-11 lg:min-w-24 lg:items-center lg:justify-end">
                        {totalDaLinhaTexto(linha)}
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
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={onAdicionarLinha}
              disabled={bloqueado}
              className="btn-admin-ghost min-h-10 w-full text-xs sm:w-auto"
            >
              <IconPlus className="h-3.5 w-3.5" />
              Adicionar artigo
            </button>
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
