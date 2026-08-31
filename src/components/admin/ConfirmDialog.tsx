"use client";

import { useEffect, useId, useRef, type MouseEvent } from "react";
import { IconAlert } from "@/components/admin/icons";

type Props = {
  open: boolean;
  /**
   * Question first, consequence after. Line breaks are preserved, so the
   * two-paragraph messages written for `window.confirm` still read correctly.
   */
  message: string;
  /** Repeats the verb of the action — never "OK". */
  confirmLabel: string;
  /** Destructive by default; "primary" for actions that only move work forward. */
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmation modal on a native <dialog> — the browser gives us the top layer,
 * the focus trap and Esc; only the skin is ours. Same bargain as
 * ProductQuickView, and the reason this replaced `window.confirm`: the browser
 * dialog can't be themed, names the domain instead of the app, and offers
 * "OK"/"Cancelar" where the confirm button should repeat the actual verb.
 */
export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  tone = "danger",
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Clicking the backdrop lands on the <dialog> itself; inner content stops there.
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target !== dialogRef.current) return;
    event.stopPropagation();
    onCancel();
  };

  return (
    <dialog
      ref={dialogRef}
      // The DOM `cancel` event fires for Esc only, which is exactly what we
      // want to mirror. Wiring `close` instead would also fire on the
      // programmatic close after a confirmation and undo it.
      //
      // `cancel` and `close` don't bubble in the DOM, but React delegates them
      // from the root and replays them down its own tree — so without
      // stopPropagation, dismissing this dialog also fires the `onClose` of any
      // dialog it is nested inside, and Esc would shut the quick view behind it
      // as well as this confirmation.
      onCancel={(event) => {
        event.stopPropagation();
        onCancel();
      }}
      onClose={(event) => event.stopPropagation()}
      onClick={onBackdropClick}
      aria-labelledby={titleId}
      className="admin-dialog admin-dialog-confirm"
    >
      <div className="p-6">
        <div className="flex gap-3.5">
          <span
            aria-hidden
            className={
              tone === "danger"
                ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-500"
                : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-a-accent/30 bg-a-accent-soft text-a-accent"
            }
          >
            <IconAlert className="h-4.5 w-4.5" />
          </span>
          <p
            id={titleId}
            className="min-w-0 whitespace-pre-line pt-1 text-sm leading-relaxed text-a-text"
          >
            {message}
          </p>
        </div>

        {/* Cancel first, so the browser's initial focus lands on the safe choice. */}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-admin-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className={tone === "danger" ? "btn-admin-danger" : "btn-admin"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
