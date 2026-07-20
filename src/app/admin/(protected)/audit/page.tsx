import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { AUDIT_ACTION_LABELS, AUDIT_GROUPS, type AuditAction } from "@/lib/audit";
import { PageHeader, EmptyState, adminInputClass } from "@/components/admin/ui";
import { IconShield } from "@/components/admin/icons";

export const metadata: Metadata = {
  title: "Auditoria",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return letters || "—";
}

type SearchParams = {
  user?: string;
  group?: string;
  q?: string;
  page?: string;
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdminRole();
  const params = await searchParams;

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const groupKey = params.group && params.group in AUDIT_GROUPS ? params.group : undefined;
  const userId = params.user?.trim() || undefined;
  const query = params.q?.trim() || undefined;

  const where: Prisma.AuditLogWhereInput = {};
  if (groupKey) where.action = { in: AUDIT_GROUPS[groupKey] };
  if (userId) where.userId = userId;
  if (query) {
    where.OR = [
      { summary: { contains: query, mode: "insensitive" } },
      { userName: { contains: query, mode: "insensitive" } },
      { userEmail: { contains: query, mode: "insensitive" } },
    ];
  }

  const [entries, total, actors] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    // Distinct actors for the filter dropdown, current members first.
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  // Preserve active filters when moving between pages.
  const pageHref = (target: number) => {
    const qs = new URLSearchParams();
    if (groupKey) qs.set("group", groupKey);
    if (userId) qs.set("user", userId);
    if (query) qs.set("q", query);
    if (target > 1) qs.set("page", String(target));
    const s = qs.toString();
    return s ? `/admin/audit?${s}` : "/admin/audit";
  };

  const hasFilters = Boolean(groupKey || userId || query);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Auditoria"
        description="Registo de todas as ações realizadas no painel, por todos os membros da equipa."
      />

      {/* Filters — a plain GET form so the state lives in the URL and is shareable. */}
      <form method="get" className="card-admin flex flex-wrap items-end gap-4 p-5">
        <div className="min-w-40 flex-1">
          <label htmlFor="f-q" className="mb-1.5 block text-sm font-medium text-a-text">
            Pesquisar
          </label>
          <input
            id="f-q"
            name="q"
            defaultValue={query}
            placeholder="Descrição, nome ou email"
            className={adminInputClass}
          />
        </div>
        <div className="min-w-44">
          <label htmlFor="f-user" className="mb-1.5 block text-sm font-medium text-a-text">
            Utilizador
          </label>
          <select id="f-user" name="user" defaultValue={userId ?? ""} className={adminInputClass}>
            <option value="">Todos</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name} ({actor.email})
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-40">
          <label htmlFor="f-group" className="mb-1.5 block text-sm font-medium text-a-text">
            Categoria
          </label>
          <select id="f-group" name="group" defaultValue={groupKey ?? ""} className={adminInputClass}>
            <option value="">Todas</option>
            {Object.keys(AUDIT_GROUPS).map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-admin px-6 py-2.5">
            Filtrar
          </button>
          {hasFilters && (
            <Link href="/admin/audit" className="btn-admin-ghost px-4 py-2.5">
              Limpar
            </Link>
          )}
        </div>
      </form>

      <div className="card-admin overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState
            icon={<IconShield className="h-5 w-5" />}
            title={hasFilters ? "Sem resultados" : "Ainda sem registos"}
            description={
              hasFilters
                ? "Nenhuma ação corresponde aos filtros escolhidos."
                : "As ações realizadas no painel vão aparecer aqui."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead>
                <tr className="border-b border-a-line text-left text-xs uppercase tracking-wider text-a-faint">
                  <th className="px-5 py-3.5 font-semibold">Quando</th>
                  <th className="px-5 py-3.5 font-semibold">Membro</th>
                  <th className="px-5 py-3.5 font-semibold">Ação</th>
                  <th className="px-5 py-3.5 font-semibold">Detalhe</th>
                </tr>
              </thead>
              <tbody className="table-rows">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-5 py-3.5 align-top">
                      <span className="whitespace-nowrap font-mono text-xs text-a-muted">
                        {formatDate(entry.createdAt)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 align-top">
                      <div className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-a-accent-soft text-[0.6rem] font-bold text-a-on-accent-soft"
                        >
                          {initials(entry.userName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-a-text">{entry.userName}</p>
                          <p className="truncate font-mono text-[0.7rem] text-a-faint">
                            {entry.userEmail}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 align-top">
                      <span className="whitespace-nowrap text-xs font-medium text-a-accent">
                        {AUDIT_ACTION_LABELS[entry.action as AuditAction] ?? entry.action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 align-top">
                      <p className="text-a-text">{entry.summary}</p>
                      {entry.ip && <p className="mt-0.5 font-mono text-[0.7rem] text-a-faint">IP {entry.ip}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-a-muted">
            {from}–{to} de {total} {total === 1 ? "registo" : "registos"}
          </p>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="btn-admin-ghost px-4 py-2">
                  ← Anterior
                </Link>
              ) : (
                <span className="btn-admin-ghost pointer-events-none px-4 py-2 opacity-40">
                  ← Anterior
                </span>
              )}
              <span className="font-mono text-xs text-a-faint">
                {page} / {pageCount}
              </span>
              {page < pageCount ? (
                <Link href={pageHref(page + 1)} className="btn-admin-ghost px-4 py-2">
                  Seguinte →
                </Link>
              ) : (
                <span className="btn-admin-ghost pointer-events-none px-4 py-2 opacity-40">
                  Seguinte →
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
