/**
 * Skeleton for Início — the same shapes in the same places, so the page does
 * not jump when the data lands.
 */
export default function CarregarInicio() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-6">
      <span className="sr-only">A carregar…</span>

      <section className="card-admin p-5">
        <div className="flex items-center gap-3">
          <Bloco className="h-6 w-40" />
          <Bloco className="ml-auto h-6 w-20 rounded-full" />
        </div>
        <Bloco className="mt-3 h-4 w-56" />
        <div className="mt-4 grid grid-cols-3 gap-2 border-y border-a-line py-3.5">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Bloco className="h-2.5 w-14" />
              <Bloco className="mt-2 h-5 w-12" />
            </div>
          ))}
        </div>
        <Bloco className="mt-4 h-1.5 w-full rounded-full" />
        <div className="mt-5 flex gap-2.5">
          <Bloco className="h-11 w-44 rounded-full" />
          <Bloco className="h-11 w-36 rounded-full" />
        </div>
      </section>

      <Bloco className="h-5 w-36" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-a-line bg-a-surface p-4">
            <Bloco className="h-5 w-24 rounded-full" />
            <Bloco className="mt-3 h-4 w-3/4" />
            <Bloco className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Bloco({ className }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded bg-a-inset ${className ?? ""}`} />;
}
