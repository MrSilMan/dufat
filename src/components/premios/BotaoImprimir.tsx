"use client";

/** Opens the browser's print dialog, where "Save as PDF" produces the file. */
export function BotaoImprimir({ label = "Imprimir" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-admin">
      {label}
    </button>
  );
}
