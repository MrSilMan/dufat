"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { adminInputClass } from "@/components/admin/ui";
import type { ResultadoPesquisa } from "@/lib/relatorios/catalogo";

/** Wait after the last keystroke before asking the server. */
const ATRASO = 300;
/** Below this, a search would match most of the catalog. */
const MINIMO = 2;

export type Sugestao = {
  /** Unique within one result list. */
  chave: string;
  /** What goes into the field when this is picked. */
  principal: string;
  /** Shown under it — a code, a NIF, a date. */
  secundario?: string | null;
  /** Shown on the right — a price, a total. */
  extra?: string | null;
  /** A small badge, e.g. where the match came from. */
  etiqueta?: string | null;
};

type Props<T> = {
  id: string;
  valor: string;
  onEscrever: (texto: string) => void;
  /** Picking fills the field and hands over everything the caller stored. */
  onEscolher: (item: T) => void;
  procurar: (termo: string) => Promise<ResultadoPesquisa<T>>;
  sugestao: (item: T) => Sugestao;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  /** Rendered under the field when there is nothing to show. */
  ajuda?: ReactNode;
  className?: string;
  onBlur?: () => void;
};

/**
 * A text field that suggests as you type, and never insists.
 *
 * Whatever is typed is the value: the suggestions fill in a name, a code and a
 * price in one tap, but a client who is not in INVGEST, or an article invented
 * this morning, is typed in and saved exactly the same way. That matters more
 * than it sounds — a till report that cannot record a sale because the catalog
 * is missing an article is worse than one with a typo in it.
 *
 * Results arrive out of order when someone types quickly, so each search
 * carries a sequence number and a late answer to an old query is dropped.
 */
export function CampoPesquisa<T>({
  id,
  valor,
  onEscrever,
  onEscolher,
  procurar,
  sugestao,
  placeholder,
  disabled,
  maxLength = 200,
  ajuda,
  className,
  onBlur,
}: Props<T>) {
  const listaId = useId();
  const [aberto, setAberto] = useState(false);
  const [resultados, setResultados] = useState<T[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aProcurar, setAProcurar] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  /** The text the open list belongs to; a new keystroke invalidates it. */
  const [termoAberto, setTermoAberto] = useState("");

  const sequencia = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const envolvente = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  // A click outside closes the list; on a phone, tapping elsewhere on the card
  // is how people dismiss it, and that must not count as picking anything.
  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: MouseEvent | TouchEvent) => {
      if (!envolvente.current?.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
    };
  }, [aberto]);

  function agendarProcura(termo: string) {
    if (temporizador.current) clearTimeout(temporizador.current);
    const limpo = termo.trim();
    if (limpo.length < MINIMO) {
      setResultados([]);
      setAviso(null);
      setAProcurar(false);
      setAberto(false);
      return;
    }
    setAProcurar(true);
    temporizador.current = setTimeout(() => void correr(limpo), ATRASO);
  }

  async function correr(termo: string) {
    const meu = ++sequencia.current;
    try {
      const resposta = await procurar(termo);
      if (meu !== sequencia.current) return;
      setResultados(resposta.resultados);
      setAviso(resposta.aviso ?? null);
      setTermoAberto(termo);
      setAtivo(resposta.resultados.length > 0 ? 0 : -1);
      setAberto(true);
    } catch {
      if (meu !== sequencia.current) return;
      setResultados([]);
      setAviso("Não foi possível procurar. Escreva à mão.");
      setAberto(true);
    } finally {
      if (meu === sequencia.current) setAProcurar(false);
    }
  }

  function escolher(item: T) {
    sequencia.current += 1; // Drop any search still in flight.
    if (temporizador.current) clearTimeout(temporizador.current);
    setAberto(false);
    setAProcurar(false);
    setResultados([]);
    onEscolher(item);
  }

  function teclado(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Escape") {
      setAberto(false);
      return;
    }
    if (!aberto || resultados.length === 0) {
      if (evento.key === "ArrowDown" && resultados.length > 0) setAberto(true);
      return;
    }
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setAtivo((atual) => (atual + 1) % resultados.length);
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setAtivo((atual) => (atual - 1 + resultados.length) % resultados.length);
    } else if (evento.key === "Enter" && ativo >= 0) {
      evento.preventDefault();
      escolher(resultados[ativo]!);
    }
  }

  // The list belongs to the text it was fetched for; showing it against newer
  // text would offer "Luminária ST89" for something already retyped.
  const mostrar = aberto && valor.trim() === termoAberto;

  return (
    <div ref={envolvente} className={cn("relative", className)}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={mostrar}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={mostrar && ativo >= 0 ? `${listaId}-${ativo}` : undefined}
        autoComplete="off"
        value={valor}
        maxLength={maxLength}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(evento) => {
          onEscrever(evento.target.value);
          agendarProcura(evento.target.value);
        }}
        onFocus={() => {
          if (resultados.length > 0 && valor.trim() === termoAberto) setAberto(true);
        }}
        onBlur={onBlur}
        onKeyDown={teclado}
        className={cn(adminInputClass, aProcurar && "pr-9")}
      />

      {aProcurar && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-a-line-strong border-t-a-accent"
        />
      )}

      {mostrar && (
        <div className="card-admin absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-xl backdrop-blur-xl">
          {resultados.length > 0 ? (
            <ul id={listaId} role="listbox" className="max-h-72 overflow-y-auto py-1">
              {resultados.map((item, indice) => {
                const dados = sugestao(item);
                return (
                  <li key={dados.chave} role="none">
                    <button
                      id={`${listaId}-${indice}`}
                      type="button"
                      role="option"
                      aria-selected={indice === ativo}
                      // mousedown, not click: blur would close the list first.
                      onMouseDown={(evento) => evento.preventDefault()}
                      onClick={() => escolher(item)}
                      onMouseEnter={() => setAtivo(indice)}
                      className={cn(
                        "flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors",
                        indice === ativo ? "bg-a-accent/10" : "hover:bg-a-line/40",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-a-text">
                          {dados.principal}
                        </span>
                        {dados.secundario && (
                          <span className="mt-0.5 block truncate text-xs text-a-muted">
                            {dados.secundario}
                          </span>
                        )}
                      </span>
                      {dados.etiqueta && (
                        <span className="shrink-0 rounded-full border border-a-line px-2 py-0.5 text-[0.65rem] font-medium text-a-faint">
                          {dados.etiqueta}
                        </span>
                      )}
                      {dados.extra && (
                        <span className="shrink-0 font-mono text-xs tabular-nums text-a-muted">
                          {dados.extra}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3.5 py-3 text-sm text-a-muted">
              {aviso ?? "Sem resultados — escreva à mão."}
            </p>
          )}

          {aviso && resultados.length > 0 && (
            <p className="border-t border-a-line px-3.5 py-2 text-xs text-amber-600">{aviso}</p>
          )}
        </div>
      )}

      {!mostrar && ajuda}
    </div>
  );
}
