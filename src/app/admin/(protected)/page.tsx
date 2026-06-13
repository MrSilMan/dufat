import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type DayCount = { day: Date; views: bigint };

export default async function AdminDashboardPage() {
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const [productCount, caseStudyCount, newQuotes, contactCount, subscriberCount, recentQuotes, viewRows] =
    await Promise.all([
      prisma.product.count(),
      prisma.caseStudy.count(),
      prisma.quoteRequest.count({ where: { status: "NEW" } }),
      prisma.contactSubmission.count(),
      prisma.newsletterSubscriber.count(),
      prisma.quoteRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { product: { select: { name: true } } },
      }),
      prisma.$queryRaw<DayCount[]>`
        SELECT date_trunc('day', "createdAt") AS day, count(*) AS views
        FROM "PageView"
        WHERE "createdAt" >= ${since}
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

  // Build a continuous 14-day series for the chart.
  const series: { label: string; views: number }[] = [];
  for (let i = 0; i < 14; i += 1) {
    const day = new Date(since);
    day.setDate(since.getDate() + i);
    const row = viewRows.find((entry) => new Date(entry.day).toDateString() === day.toDateString());
    series.push({
      label: day.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
      views: row ? Number(row.views) : 0,
    });
  }
  const maxViews = Math.max(1, ...series.map((entry) => entry.views));

  const cards = [
    { label: "Produtos", value: productCount, href: "/admin/products" },
    { label: "Casos de estudo", value: caseStudyCount, href: "/admin/case-studies" },
    { label: "Orçamentos novos", value: newQuotes, href: "/admin/quotes" },
    { label: "Mensagens recebidas", value: contactCount, href: "/admin" },
    { label: "Subscritores", value: subscriberCount, href: "/admin" },
  ];

  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-black">Painel</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="card-night p-5 transition-colors hover:border-dufat-sky/40">
            <p className="font-display text-3xl font-black text-dufat-sky">{card.value}</p>
            <p className="mt-1 text-sm text-white/60">{card.label}</p>
          </Link>
        ))}
      </div>

      <section aria-labelledby="views-title" className="card-night p-6">
        <h2 id="views-title" className="text-lg font-bold">
          Visualizações de página — últimos 14 dias
        </h2>
        <div className="mt-6 flex h-44 items-end gap-1.5" role="img" aria-label="Gráfico de visualizações diárias">
          {series.map((entry) => (
            <div key={entry.label} className="group flex flex-1 flex-col items-center gap-2">
              <span className="text-xs text-white/40 opacity-0 transition-opacity group-hover:opacity-100">
                {entry.views}
              </span>
              <div
                className="w-full rounded-t bg-dufat transition-colors group-hover:bg-dufat-sky"
                style={{ height: `${Math.max(2, (entry.views / maxViews) * 130)}px` }}
              />
              <span className="text-[10px] text-white/40">{entry.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="recent-quotes-title">
        <div className="flex items-center justify-between">
          <h2 id="recent-quotes-title" className="text-lg font-bold">
            Últimos pedidos de orçamento
          </h2>
          <Link href="/admin/quotes" className="text-sm text-dufat-sky hover:underline">
            Ver todos →
          </Link>
        </div>
        <div className="card-night mt-4 divide-y divide-night-line">
          {recentQuotes.length === 0 && (
            <p className="p-6 text-sm text-white/50">Ainda sem pedidos.</p>
          )}
          {recentQuotes.map((quote) => (
            <div key={quote.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 p-4 text-sm">
              <span className="font-semibold">{quote.name}</span>
              <span className="text-white/55">{quote.email}</span>
              <span className="text-white/55">{quote.product?.name ?? "Projeto completo"}</span>
              <span className="ml-auto rounded-full border border-night-line px-2.5 py-0.5 text-xs uppercase tracking-wide text-dufat-sky">
                {quote.status}
              </span>
              <span className="text-xs text-white/40">{formatDate(quote.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
