"use client";

import { useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

type Props = {
  children: ReactNode;
  confirmMessage: string;
  /** Defaults to the trigger's own label, so the modal repeats the verb. */
  confirmLabel?: string;
  /** Destructive by default; "primary" for actions that only move work forward. */
  tone?: "danger" | "primary";
  className?: string;
};

/** Submit button that asks for confirmation before letting the form action run. */
export function DangerSubmit({
  children,
  confirmMessage,
  confirmLabel,
  tone = "danger",
  className,
}: Props) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [aPerguntar, setAPerguntar] = useState(false);

  return (
    <>
      <button
        ref={buttonRef}
        // Stays a submit button so the form keeps a submitter and still works
        // if this component never hydrates; the modal only decides whether the
        // submission goes through.
        type="submit"
        className={className}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.preventDefault();
          setAPerguntar(true);
        }}
      >
        {children}
      </button>

      <ConfirmDialog
        open={aPerguntar}
        message={confirmMessage}
        confirmLabel={confirmLabel ?? (typeof children === "string" ? children : "Confirmar")}
        tone={tone}
        onCancel={() => setAPerguntar(false)}
        onConfirm={() => {
          setAPerguntar(false);
          // requestSubmit() dispatches `submit`, not `click`, so this cannot
          // bounce back into the handler above.
          const button = buttonRef.current;
          button?.form?.requestSubmit(button);
        }}
      />
    </>
  );
}
