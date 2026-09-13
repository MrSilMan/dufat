"use client";

import { useState, useTransition } from "react";
import { alterarAcessoRelatorios } from "@/server/actions/relatorios";
import { cn } from "@/lib/cn";

type Acesso = { registar: boolean; ver: boolean };

/**
 * One person's two report grants, saved the moment a switch flips. On failure
 * the switch goes back to what the server still has, so the screen never shows
 * access that was not actually given.
 */
export function AcessoRelatoriosLinha({
  userId,
  nome,
  detalhe,
  inicial,
}: {
  userId: string;
  nome: string;
  detalhe: string;
  inicial: Acesso;
}) {
  const [acesso, setAcesso] = useState<Acesso>(inicial);
  const [pending, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  function alternar(campo: keyof Acesso, valor: boolean) {
    const anterior = acesso;
    const proximo = { ...acesso, [campo]: valor };
    setAcesso(proximo);
    setAviso(null);
    startTransition(async () => {
      try {
        const resultado = await alterarAcessoRelatorios({ userId, ...proximo });
        if (resultado.ok) {
          setAviso({ ok: true, texto: "Guardado" });
        } else {
          setAcesso(anterior);
          setAviso({ ok: false, texto: resultado.message });
        }
      } catch {
        setAcesso(anterior);
        setAviso({ ok: false, texto: "Sem ligação — não foi guardado." });
      }
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3.5">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-semibold text-a-text">{nome}</p>
        <p className="mt-0.5 truncate text-xs text-a-faint">{detalhe}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Interruptor
          rotulo="Registar relatórios"
          ativo={acesso.registar}
          desativado={pending}
          onChange={(valor) => alternar("registar", valor)}
        />
        <Interruptor
          rotulo="Ver relatórios de todos"
          ativo={acesso.ver}
          desativado={pending}
          onChange={(valor) => alternar("ver", valor)}
        />
        <span
          role="status"
          className={cn(
            "min-w-20 text-xs",
            pending ? "text-a-muted" : aviso?.ok ? "text-emerald-600" : "text-rose-500",
          )}
        >
          {pending ? "A guardar…" : (aviso?.texto ?? "")}
        </span>
      </div>
    </li>
  );
}

function Interruptor({
  rotulo,
  ativo,
  desativado,
  onChange,
}: {
  rotulo: string;
  ativo: boolean;
  desativado: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-a-text">
      <input
        type="checkbox"
        checked={ativo}
        disabled={desativado}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span aria-hidden className="admin-switch" />
      {rotulo}
    </label>
  );
}
