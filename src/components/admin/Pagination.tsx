import Link from "next/link";

type Props = {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  /** Current query string minus `page` — preserved on every page link. */
  params: Record<string, string>;
  /** Noun for the range readout, e.g. "produtos". */
  noun: string;
};

/** Page numbers around the current one, collapsing long runs into an ellipsis. */
function pageWindow(page: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set([1, pageCount, page, page - 1, page + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  return sorted.flatMap((n, index) =>
    index > 0 && n - sorted[index - 1]! > 1 ? (["gap", n] as (number | "gap")[]) : [n],
  );
}

const linkBase =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-sm transition-colors";

export function Pagination({ page, pageCount, total, from, to, params, noun }: Props) {
  const href = (target: number) => {
    const search = new URLSearchParams(params);
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `?${query}` : "?";
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-a-line px-5 py-3.5">
      <p className="text-xs text-a-muted">
        {total === 0 ? `Sem ${noun}` : `${from}–${to} de ${total} ${noun}`}
      </p>

      {pageCount > 1 && (
        <nav aria-label="Paginação" className="flex items-center gap-1.5">
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" aria-label="Página anterior" className={`${linkBase} border-a-line text-a-muted hover:border-a-line-strong hover:text-a-text`}>
              ‹
            </Link>
          ) : (
            <span aria-hidden className={`${linkBase} border-a-line text-a-faint opacity-50`}>‹</span>
          )}

          {pageWindow(page, pageCount).map((entry, index) =>
            entry === "gap" ? (
              <span key={`gap-${index}`} className="px-1 text-sm text-a-faint">
                …
              </span>
            ) : entry === page ? (
              <span
                key={entry}
                aria-current="page"
                className={`${linkBase} border-transparent bg-a-accent-soft font-semibold text-a-on-accent-soft`}
              >
                {entry}
              </span>
            ) : (
              <Link
                key={entry}
                href={href(entry)}
                className={`${linkBase} border-a-line text-a-muted hover:border-a-line-strong hover:text-a-text`}
              >
                {entry}
              </Link>
            ),
          )}

          {page < pageCount ? (
            <Link href={href(page + 1)} rel="next" aria-label="Página seguinte" className={`${linkBase} border-a-line text-a-muted hover:border-a-line-strong hover:text-a-text`}>
              ›
            </Link>
          ) : (
            <span aria-hidden className={`${linkBase} border-a-line text-a-faint opacity-50`}>›</span>
          )}
        </nav>
      )}
    </div>
  );
}
