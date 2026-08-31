import { prisma } from "@/lib/db";
import { requireCatalogo } from "@/lib/auth";
import { updateQuoteStatus } from "@/server/actions/admin";
import { formatDate } from "@/lib/format";
import { PageHeader, StatusBadge, EmptyState, adminInputClass } from "@/components/admin/ui";
import { IconInbox } from "@/components/admin/icons";

export const dynamic = "force-dynamic";

const statusOptions = [
  { value: "NEW", label: "Novo" },
  { value: "IN_PROGRESS", label: "Em curso" },
  { value: "WON", label: "Ganho" },
  { value: "CLOSED", label: "Fechado" },
];

export default async function AdminQuotesPage() {
  await requireCatalogo();
  const quotes = await prisma.quoteRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { product: { select: { name: true } } },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Pedidos de Orçamento"
        description="Pedidos enviados pelo site, do mais recente para o mais antigo."
      />

      <div className="card-admin list-rows overflow-hidden">
        {quotes.length === 0 && (
          <EmptyState
            icon={<IconInbox className="h-5 w-5" />}
            title="Ainda sem pedidos"
            description="Os pedidos de orçamento enviados pelo site aparecem aqui."
          />
        )}
        {quotes.map((quote) => (
          <article key={quote.id} className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
              <div className="min-w-52 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="font-semibold text-a-text">{quote.name}</p>
                  {quote.company && (
                    <span className="rounded-full border border-a-line px-2 py-0.5 text-xs text-a-muted">
                      {quote.company}
                    </span>
                  )}
                  <StatusBadge status={quote.status} />
                </div>
                <p className="mt-1 text-xs text-a-faint">
                  {quote.email}
                  {quote.phone && ` · ${quote.phone}`}
                </p>
                <p className="mt-1 text-sm text-a-accent">
                  {quote.product?.name ?? "Projeto completo"}
                  {quote.quantity && (
                    <span className="text-a-muted"> × {quote.quantity}</span>
                  )}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2.5">
                <span className="font-mono text-xs text-a-faint">{formatDate(quote.createdAt)}</span>
                <form action={updateQuoteStatus} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={quote.id} />
                  <label htmlFor={`status-${quote.id}`} className="sr-only">
                    Estado
                  </label>
                  <select
                    id={`status-${quote.id}`}
                    name="status"
                    defaultValue={quote.status}
                    className={`${adminInputClass} w-auto rounded-full py-1.5 pr-8 text-xs`}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn-admin-ghost px-3.5 py-1.5 text-xs">
                    Atualizar
                  </button>
                </form>
              </div>
            </div>

            <p className="mt-4 max-w-3xl rounded-xl border border-a-line bg-a-inset p-3.5 text-sm leading-relaxed text-a-muted">
              {quote.message}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
