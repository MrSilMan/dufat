"use client";

import { useActionState, useEffect, useRef, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { guardarAtividade } from "@/server/actions/atividades";
import { AdminField, adminInputClass } from "@/components/admin/ui";
import { initialFormState, type FormState } from "@/lib/validation";

export type CategoriaOpcao = { id: string; nome: string };

export type RegistoEmEdicao = {
  id: string;
  categoriaId: string;
  descricao: string;
  /** `YYYY-MM-DD` and `HH:MM`, already formatted on the server. */
  dia: string;
  inicio: string;
  fim: string;
  /** Present when the entry was sent back — the question being answered. */
  notaRevisao: string | null;
  justificar: boolean;
};

type Props = {
  aberto: boolean;
  categorias: CategoriaOpcao[];
  /** Sensible default day, clamped to the month the sheet covers. */
  hoje: string;
  minDia: string;
  maxDia: string;
  emEdicao: RegistoEmEdicao | null;
  /** Where cancelling or dismissing returns to — the screen it opened over. */
  voltarPara: string;
};

/**
 * The entry form, as a sheet rather than a permanent block on the page.
 *
 * It used to sit between the summary and the list, which meant every visit
 * scrolled past a form to reach yesterday's work. As a sheet it is one tap from
 * anywhere, and the page behind it can be about one thing again.
 *
 * Driven by the URL (`?registar=1`, `?registo=<id>`) so the phone's back
 * gesture closes it, and so a flagged entry's "Justificar" button can link
 * straight into it pre-filled.
 *
 * A successful save is *not* handled here: `guardarAtividade` redirects to the
 * list itself. This component only ever renders the form and whatever the
 * server said went wrong, so there is no success path that can be lost between
 * the write and the screen.
 */
export function RegistarSheet({
  aberto,
  categorias,
  hoje,
  minDia,
  maxDia,
  emEdicao,
  voltarPara,
}: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<FormState, FormData>(
    guardarAtividade,
    initialFormState,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (aberto && !dialog.open) dialog.showModal();
    if (!aberto && dialog.open) dialog.close();
  }, [aberto]);

  const fechar = () => router.push(voltarPara, { scroll: false });

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) fechar();
  };

  const titulo = emEdicao
    ? emEdicao.justificar
      ? "Justificar registo"
      : "Editar registo"
    : "Registar atividade";

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.stopPropagation();
        fechar();
      }}
      onClose={(event) => event.stopPropagation()}
      onClick={onBackdropClick}
      aria-labelledby="registar-titulo"
      className="equipa-sheet"
    >
      {aberto && (
        <form
          key={emEdicao?.id ?? "novo"}
          action={action}
          noValidate
          className="flex max-h-[inherit] flex-col"
        >
          {emEdicao && <input type="hidden" name="id" value={emEdicao.id} />}

          <header className="flex items-center gap-3 border-b border-a-line px-5 py-4">
            <h2 id="registar-titulo" className="font-display text-base font-bold text-a-text">
              {titulo}
            </h2>
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar"
              className="ml-auto flex h-11 w-11 items-center justify-center rounded-xl text-a-faint transition-colors hover:bg-a-hover hover:text-a-text"
            >
              <span aria-hidden className="text-xl leading-none">
                ×
              </span>
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {emEdicao?.notaRevisao && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-a-text">
                <span className="font-semibold">Nota do revisor:</span> {emEdicao.notaRevisao}
              </p>
            )}

            <AdminField label="Categoria" htmlFor="categoriaId" errors={state.errors?.categoriaId}>
              <select
                id="categoriaId"
                name="categoriaId"
                required
                defaultValue={emEdicao?.categoriaId}
                className={adminInputClass}
              >
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
            </AdminField>

            <AdminField
              label="Dia"
              htmlFor="dia"
              errors={state.errors?.dia}
              hint="Registe no próprio dia ou no seguinte — registos feitos em bloco no fim do mês baixam a pontuação de pontualidade."
            >
              <input
                id="dia"
                name="dia"
                type="date"
                required
                defaultValue={emEdicao?.dia ?? hoje}
                min={minDia}
                max={maxDia}
                className={adminInputClass}
              />
            </AdminField>

            <div className="grid grid-cols-2 gap-4">
              <AdminField label="Início" htmlFor="inicio" errors={state.errors?.inicio}>
                <input
                  id="inicio"
                  name="inicio"
                  type="time"
                  required
                  defaultValue={emEdicao?.inicio}
                  className={adminInputClass}
                />
              </AdminField>

              <AdminField label="Fim" htmlFor="fim" errors={state.errors?.fim}>
                <input
                  id="fim"
                  name="fim"
                  type="time"
                  required
                  defaultValue={emEdicao?.fim}
                  className={adminInputClass}
                />
              </AdminField>
            </div>

            <AdminField
              label="Descrição"
              htmlFor="descricao"
              errors={state.errors?.descricao}
              hint="Seja concreto: quem valida a folha precisa de perceber o que foi feito."
            >
              <textarea
                id="descricao"
                name="descricao"
                rows={3}
                required
                maxLength={500}
                defaultValue={emEdicao?.descricao}
                className={adminInputClass}
                placeholder="Ex.: conferência e entrada em stock da encomenda 2026/418"
              />
            </AdminField>
          </div>

          {/* Pinned: on a phone the fields can outgrow the sheet, and the button
              you came for should never be the thing you have to scroll to. */}
          <footer className="equipa-safe-bottom border-t border-a-line px-5 py-4">
            {state.message && !state.ok && (
              <p role="alert" className="mb-3 text-sm text-rose-500">
                {state.message}
              </p>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fechar}
                className="btn-admin-ghost min-h-11 flex-1 sm:flex-none"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="btn-admin min-h-11 flex-1 sm:flex-none sm:px-8"
              >
                {pending ? "A guardar…" : emEdicao ? "Guardar" : "Adicionar"}
              </button>
            </div>
          </footer>
        </form>
      )}
    </dialog>
  );
}
