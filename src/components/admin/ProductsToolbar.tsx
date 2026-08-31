"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { adminInputClass } from "@/components/admin/ui";

type Props = { categories: { id: string; name: string }[] };

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Search + filters for the products list. Writes to the query string, so the
 * server component re-queries and the state survives reloads and back/forward.
 */
export function ProductsToolbar({ categories }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [term, setTerm] = useState(searchParams.get("q") ?? "");

  const activeQ = searchParams.get("q") ?? "";
  const activeEstado = searchParams.get("estado") ?? "";
  const activeCat = searchParams.get("cat") ?? "";
  const hasFilters = Boolean(activeQ || activeEstado || activeCat);

  const navigate = (changes: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    // Any filter change invalidates the offset — go back to the first page.
    next.delete("page");
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
  };

  // Debounce typing so each keystroke doesn't hit the database.
  useEffect(() => {
    if (term === activeQ) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (term) next.set("q", term);
      else next.delete("q");
      next.delete("page");
      const query = next.toString();
      startTransition(() => router.push(query ? `${pathname}?${query}` : pathname));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, activeQ, pathname, router, searchParams]);

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-a-line px-5 py-3.5">
      <div className="relative min-w-56 flex-1">
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Pesquisar por nome, slug, SKU ou código…"
          aria-label="Pesquisar produtos"
          className={`${adminInputClass} pl-9`}
        />
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-a-faint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
        </span>
      </div>

      <select
        value={activeEstado}
        onChange={(event) => navigate({ estado: event.target.value })}
        aria-label="Filtrar por estado"
        className={`${adminInputClass} w-auto`}
      >
        <option value="">Todos os estados</option>
        <option value="publicado">Publicado</option>
        <option value="rascunho">Rascunho</option>
      </select>

      <select
        value={activeCat}
        onChange={(event) => navigate({ cat: event.target.value })}
        aria-label="Filtrar por categoria"
        className={`${adminInputClass} w-auto`}
      >
        <option value="">Todas as categorias</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setTerm("");
            navigate({ q: "", estado: "", cat: "" });
          }}
          className="text-sm text-a-muted underline-offset-2 transition-colors hover:text-a-text hover:underline"
        >
          Limpar
        </button>
      )}

      <span role="status" className={`text-xs text-a-faint ${pending ? "opacity-100" : "opacity-0"}`}>
        A filtrar…
      </span>
    </div>
  );
}
