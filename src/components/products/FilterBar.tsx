"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

type Category = { slug: string; name: string };

export function FilterBar({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeCategory = searchParams.get("category") ?? "";
  const activeSort = searchParams.get("sort") ?? "recent";
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Debounced full-text search, backed by Postgres FTS + Redis on the server.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if ((searchParams.get("q") ?? "") !== search) navigate({ q: search });
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="sticky top-[4.75rem] z-40 border-y border-line bg-paper/90 py-4 backdrop-blur-md md:top-[5.25rem]">
      <div className="container-site flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoria">
          <button
            type="button"
            onClick={() => navigate({ category: "" })}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              !activeCategory
                ? "border-transparent bg-gradient-to-r from-dufat-bright to-dufat text-white shadow-[0_10px_22px_-10px_rgba(17,79,140,0.6)]"
                : "border-line bg-white text-ink-soft hover:border-dufat/40 hover:text-ink",
            )}
          >
            Todos
          </button>
          {categories.map((category) => (
            <button
              key={category.slug}
              type="button"
              onClick={() => navigate({ category: category.slug })}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                activeCategory === category.slug
                  ? "border-dufat bg-dufat text-white"
                  : "border-line bg-white text-ink-soft hover:border-dufat/40 hover:text-ink",
              )}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <label htmlFor="catalog-search" className="sr-only">
            Pesquisar produtos
          </label>
          <input
            id="catalog-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar… (ex.: ST89, poste 10m)"
            className="w-56 rounded-full border border-line bg-white px-4 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-dufat-bright md:w-72"
          />
          <label htmlFor="catalog-sort" className="sr-only">
            Ordenar
          </label>
          <select
            id="catalog-sort"
            value={activeSort}
            onChange={(event) => navigate({ sort: event.target.value })}
            className="rounded-full border border-line bg-white px-4 py-2 text-sm text-ink"
          >
            <option value="recent">Mais recentes</option>
            <option value="name">Nome A–Z</option>
            <option value="power">Potência</option>
          </select>
        </div>
      </div>
    </div>
  );
}
