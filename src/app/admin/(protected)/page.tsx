import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PageHeader, StatusBadge, EmptyState } from "@/components/admin/ui";
import { IconBook, IconBox, IconInbox, IconMail, IconUsers } from "@/components/admin/icons";

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
  const totalViews = series.reduce((sum, entry) => sum + entry.views, 0);

  const cards = [
    { label: "Produtos", value: productCount, href: "/admin/products", icon: IconBox },
    { label: "Casos de estudo", value: caseStudyCount, href: "/admin/case-studies", icon: IconBook },
    { label: "Orçamentos novos", value: newQuotes, href: "/admin/quotes", icon: IconInbox },
    { label: "Mensagens recebidas", value: contactCount, icon: IconMail },
    { label: "Subscritores", value: subscriberCount, icon: IconUsers },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Painel" description="Visão geral da atividade do site e dos pedidos recebidos." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => {
          const inner = (
            <>
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-a-accent-soft text-a-accent">
                  <card.icon className="h-5 w-5" />
                </span>
                {card.href && (
                  <span
                    aria-hidden
                    className="text-a-faint transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-a-accent"
                  >
                    →
                  </span>
                )}
              </div>
              <p className="mt-4 font-display text-3xl font-black text-a-text">{card.value}</p>
              <p className="mt-0.5 text-sm text-a-muted">{card.label}</p>
            </>
          );

          return card.href ? (
            <Link
              key={card.label}
              href={card.href}
              className="card-admin group p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-a-line-strong"
            >
              {inner}
            </Link>
          ) : (
            <div key={card.label} className="card-admin p-5">
              {inner}
            </div>
          );
        })}
      </div>

      <section aria-labelledby="views-title" className="card-admin p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="views-title" className="font-display text-lg font-bold text-a-text">
              Visualizações de página
            </h2>
            <p className="mt-0.5 text-sm text-a-muted">Últimos 14 dias</p>
          </div>
          <span className="rounded-full border border-a-line bg-a-inset px-3.5 py-1.5 font-mono text-xs text-a-accent">
            {totalViews} no total
          </span>
        </div>

        <div className="relative mt-8">
          {/* Gridlines with reference values */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-37.5">
            {[
              { top: 0, value: maxViews },
              { top: 75, value: Math.round(maxViews / 2) },
            ].map((line) => (
              <div
                key={line.top}
                className="absolute inset-x-0 border-t border-dashed border-a-line"
                style={{ top: `${line.top}px` }}
              >
                <span className="absolute -top-2 right-0 font-mono text-[10px] text-a-faint">
                  {line.value}
                </span>
              </div>
            ))}
          </div>

          <div className="flex h-37.5 items-end gap-1.5" role="img" aria-label="Gráfico de visualizações diárias">
            {series.map((entry, index) => {
              const isToday = index === series.length - 1;
              return (
                <div
                  key={entry.label}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end"
                >
                  <span className="pointer-events-none absolute -top-6 z-10 rounded-md border border-a-line bg-a-surface px-1.5 py-0.5 font-mono text-[10px] text-a-accent opacity-0 transition-opacity group-hover:opacity-100">
                    {entry.views}
                  </span>
                  <div
                    className={
                      isToday
                        ? "w-full rounded-t-md bg-linear-to-t from-dufat-bright to-dufat-sky"
                        : "w-full rounded-t-md bg-linear-to-t from-dufat to-dufat-bright transition-colors duration-200 group-hover:from-dufat-bright group-hover:to-dufat-sky"
                    }
                    style={{ height: `${Math.max(3, (entry.views / maxViews) * 150)}px` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1.5 border-t border-a-line pt-2">
            {series.map((entry, index) => (
              <span
                key={entry.label}
                className={`flex-1 text-center font-mono text-[10px] ${
                  index === series.length - 1 ? "font-semibold text-a-accent" : "text-a-faint"
                }`}
              >
                {entry.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="recent-quotes-title">
        <div className="flex items-center justify-between">
          <h2 id="recent-quotes-title" className="font-display text-lg font-bold text-a-text">
            Últimos pedidos de orçamento
          </h2>
          <Link
            href="/admin/quotes"
            className="text-sm font-medium text-a-accent transition-colors hover:text-a-text"
          >
            Ver todos →
          </Link>
        </div>
        <div className="card-admin mt-4 list-rows overflow-hidden">
          {recentQuotes.length === 0 && (
            <EmptyState
              icon={<IconInbox className="h-5 w-5" />}
              title="Ainda sem pedidos"
              description="Os pedidos de orçamento enviados pelo site aparecem aqui."
            />
          )}
          {recentQuotes.map((quote) => (
            <div
              key={quote.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-1.5 p-4 text-sm"
            >
              <div className="min-w-40">
                <p className="font-semibold text-a-text">{quote.name}</p>
                <p className="text-xs text-a-faint">{quote.email}</p>
              </div>
              <span className="text-a-muted">{quote.product?.name ?? "Projeto completo"}</span>
              <span className="ml-auto">
                <StatusBadge status={quote.status} />
              </span>
              <span className="font-mono text-xs text-a-faint">{formatDate(quote.createdAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
