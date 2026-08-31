import { Bloco } from "@/app/equipa/(app)/loading";

export default function CarregarRegistos() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-5">
      <span className="sr-only">A carregar registos…</span>

      <Bloco className="h-7 w-32" />
      <div className="flex gap-2">
        {["w-20", "w-28", "w-36", "w-28"].map((largura, i) => (
          <Bloco key={i} className={`h-11 rounded-full ${largura}`} />
        ))}
      </div>

      <div className="space-y-6">
        {[0, 1].map((grupo) => (
          <div key={grupo}>
            <Bloco className="h-4 w-40" />
            <div className="mt-3 space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-2xl border border-a-line bg-a-surface p-4">
                  <Bloco className="h-5 w-24 rounded-full" />
                  <Bloco className="mt-3 h-4 w-2/3" />
                  <Bloco className="mt-2 h-3 w-1/2" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
