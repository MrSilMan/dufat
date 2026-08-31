"use client";

import { useState } from "react";
import { revisarAtividade } from "@/server/actions/atividades";
import { adminInputClass } from "@/components/admin/ui";

type Acao = "validar" | "questionar" | "rejeitar" | "reabrir";

/**
 * Per-activity verdict controls.
 *
 * Questioning and rejecting open a note field first: both cost the employee
 * points, and a penalty nobody explained is one the employee cannot learn from.
 */
export function RevisaoAtividade({
  atividadeId,
  estado,
}: {
  atividadeId: string;
  estado: string;
}) {
  const [acaoAberta, setAcaoAberta] = useState<Acao | null>(null);

  const jaDecidida = estado === "VALIDADA" || estado === "REJEITADA";

  if (acaoAberta === "questionar" || acaoAberta === "rejeitar") {
    return (
      <form action={revisarAtividade} className="w-full space-y-2">
        <input type="hidden" name="id" value={atividadeId} />
        <input type="hidden" name="acao" value={acaoAberta} />
        <textarea
          name="nota"
          rows={2}
          required
          minLength={5}
          autoFocus
          className={`${adminInputClass} text-xs`}
          placeholder={
            acaoAberta === "questionar"
              ? "O que precisa de ser justificado?"
              : "Porque está a rejeitar este registo?"
          }
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setAcaoAberta(null)}
            className="btn-admin-ghost px-3 py-1 text-xs"
          >
            Cancelar
          </button>
          <button type="submit" className="btn-admin px-3 py-1 text-xs">
            {acaoAberta === "questionar" ? "Pedir justificação" : "Rejeitar"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
      {!jaDecidida && (
        <form action={revisarAtividade}>
          <input type="hidden" name="id" value={atividadeId} />
          <input type="hidden" name="acao" value="validar" />
          <button
            type="submit"
            className="rounded-lg border border-emerald-500/40 px-2.5 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/10"
          >
            Validar
          </button>
        </form>
      )}
      {!jaDecidida && (
        <button
          type="button"
          onClick={() => setAcaoAberta("questionar")}
          className="rounded-lg border border-a-line px-2.5 py-1 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
        >
          Questionar
        </button>
      )}
      {!jaDecidida && (
        <button
          type="button"
          onClick={() => setAcaoAberta("rejeitar")}
          className="btn-row-danger px-2.5 py-1 text-xs"
        >
          Rejeitar
        </button>
      )}
      {jaDecidida && (
        <form action={revisarAtividade}>
          <input type="hidden" name="id" value={atividadeId} />
          <input type="hidden" name="acao" value="reabrir" />
          <button
            type="submit"
            className="rounded-lg border border-a-line px-2.5 py-1 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
          >
            Reabrir
          </button>
        </form>
      )}
    </div>
  );
}
