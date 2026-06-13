import { prisma } from "@/lib/db";
import { updateQuoteStatus } from "@/server/actions/admin";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusOptions = [
  { value: "NEW", label: "Novo" },
  { value: "IN_PROGRESS", label: "Em curso" },
  { value: "WON", label: "Ganho" },
  { value: "CLOSED", label: "Fechado" },
];

export default async function AdminQuotesPage() {
  const quotes = await prisma.quoteRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { product: { select: { name: true } } },
  });

  return (
    <div>
      <h1 className="text-3xl font-black">Pedidos de Orçamento</h1>

      <div className="card-night mt-8 divide-y divide-night-line">
        {quotes.length === 0 && <p className="p-6 text-sm text-white/50">Ainda sem pedidos.</p>}
        {quotes.map((quote) => (
          <article key={quote.id} className="p-5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="min-w-48 flex-1">
                <p className="font-semibold">
                  {quote.name}
                  {quote.company && <span className="text-white/50"> · {quote.company}</span>}
                </p>
                <p className="text-xs text-white/45">
                  {quote.email}
                  {quote.phone && ` · ${quote.phone}`}
                </p>
              </div>
              <p className="text-sm text-white/65">
                {quote.product?.name ?? "Projeto completo"}
                {quote.quantity && ` × ${quote.quantity}`}
              </p>
              <form action={updateQuoteStatus} className="flex items-center gap-2">
                <input type="hidden" name="id" value={quote.id} />
                <label htmlFor={`status-${quote.id}`} className="sr-only">
                  Estado
                </label>
                <select
                  id={`status-${quote.id}`}
                  name="status"
                  defaultValue={quote.status}
                  className="rounded-full border border-night-line bg-night-soft px-3 py-1.5 text-xs text-white"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-full border border-night-line px-3 py-1.5 text-xs text-dufat-sky hover:border-dufat-sky/50"
                >
                  Atualizar
                </button>
              </form>
              <span className="text-xs text-white/40">{formatDate(quote.createdAt)}</span>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/70">{quote.message}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
