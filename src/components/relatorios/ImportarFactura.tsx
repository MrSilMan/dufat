"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { adminInputClass } from "@/components/admin/ui";
import { formatCentimosNumero } from "@/lib/relatorios/dinheiro";
import { obterFactura, pesquisarFacturas } from "@/server/actions/relatorios-catalogo";
import type { FacturaCarregada, FacturaEncontrada } from "@/lib/relatorios/catalogo";

/** Documents the colaborador issued in INVGEST, newest first. */
function dataCurta(iso: string | null): string {
  if (!iso) return "";
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? ""
    : data.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Fills a record in from a document already issued in INVGEST.
 *
 * This is the shortest path through the whole screen: someone who invoiced the
 * sale a minute ago picks the document and gets the client, the articles, the
 * quantities and the prices without typing any of it. Nothing is written back
 * to INVGEST — the document is read, and what comes out is an ordinary record
 * the colaborador can still correct before it is saved.
 */
export function ImportarFactura({
  disabled,
  onImportada,
}: {
  disabled?: boolean;
  onImportada: (factura: FacturaCarregada) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [facturas, setFacturas] = useState<FacturaEncontrada[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [aImportar, setAImportar] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const painel = useRef<HTMLDivElement>(null);
  const sequencia = useRef(0);

  useEffect(() => {
    if (!aberto) return;
    const fora = (evento: MouseEvent) => {
      if (!painel.current?.contains(evento.target as Node)) setAberto(false);
    };
    const escape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", escape);
    };
  }, [aberto]);

  // Opening shows the recent documents at once; typing narrows them. The list
  // is one cached fetch server-side, so filtering costs nothing.
  useEffect(() => {
    if (!aberto) return;
    const meu = ++sequencia.current;
    const temporizador = setTimeout(async () => {
      setACarregar(true);
      try {
        const resposta = await pesquisarFacturas(termo);
        if (meu !== sequencia.current) return;
        setFacturas(resposta.resultados);
        setAviso(resposta.aviso ?? null);
      } catch {
        if (meu !== sequencia.current) return;
        setFacturas([]);
        setAviso("Não foi possível obter as facturas.");
      } finally {
        if (meu === sequencia.current) setACarregar(false);
      }
    }, termo ? 300 : 0);
    return () => clearTimeout(temporizador);
  }, [aberto, termo]);

  async function importar(factura: FacturaEncontrada) {
    setAImportar(factura.invgestId);
    setErro(null);
    try {
      const resultado = await obterFactura(factura.invgestId);
      if (!resultado.ok) {
        setErro(resultado.message);
        return;
      }
      setAberto(false);
      setTermo("");
      onImportada(resultado.factura);
    } catch {
      setErro("Sem ligação — tente de novo.");
    } finally {
      setAImportar(null);
    }
  }

  return (
    <div ref={painel} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
        className="btn-admin-ghost min-h-11 whitespace-nowrap"
      >
        Da factura…
      </button>

      {aberto && (
        <div className="card-admin absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] p-4 backdrop-blur-xl sm:w-96">
          <p className="text-sm font-semibold text-a-text">Preencher a partir da INVGEST</p>
          <p className="mt-1 text-xs text-a-muted">
            Escolha um documento emitido e o registo fica preenchido com o cliente e os artigos.
            Aparecem os dos últimos 60 dias — um documento mais antigo escreve-se à mão.
          </p>

          <input
            type="text"
            value={termo}
            autoFocus
            onChange={(evento) => setTermo(evento.target.value)}
            placeholder="Número ou cliente…"
            aria-label="Procurar documento"
            className={cn(adminInputClass, "admin-input-sm mt-3")}
          />

          <div className="mt-3 max-h-72 overflow-y-auto">
            {aCarregar && facturas.length === 0 ? (
              <p className="py-3 text-center text-xs text-a-muted">A carregar…</p>
            ) : facturas.length === 0 ? (
              <p className="py-3 text-center text-xs text-a-muted">
                {aviso ?? "Sem documentos para mostrar."}
              </p>
            ) : (
              <ul className="space-y-1">
                {facturas.map((factura) => (
                  <li key={factura.invgestId}>
                    <button
                      type="button"
                      disabled={aImportar !== null}
                      onClick={() => void importar(factura)}
                      className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-a-line/40 disabled:opacity-50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-a-text">
                          {factura.codigo}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-a-muted">
                          {[factura.clienteNome, dataCurta(factura.data)]
                            .filter(Boolean)
                            .join(" · ") || "Sem cliente"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block font-mono text-xs tabular-nums text-a-text">
                          {formatCentimosNumero(factura.totalCentimos)}
                        </span>
                        <span className="mt-0.5 block text-[0.65rem] text-a-faint">
                          {aImportar === factura.invgestId
                            ? "a abrir…"
                            : `${factura.numLinhas} linha(s)`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {aviso && facturas.length > 0 && (
            <p className="mt-2 text-xs text-amber-600">{aviso}</p>
          )}
          {erro && (
            <p role="alert" className="mt-2 text-xs text-rose-500">
              {erro}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
