"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  confirmMessage: string;
  className?: string;
};

/** Submit button that asks for confirmation before letting the form action run. */
export function DangerSubmit({ children, confirmMessage, className }: Props) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
