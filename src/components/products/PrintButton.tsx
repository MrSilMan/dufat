"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-dufat px-6 py-3 font-semibold text-white transition-colors hover:bg-dufat-bright print:hidden"
    >
      Imprimir / Guardar como PDF
    </button>
  );
}
