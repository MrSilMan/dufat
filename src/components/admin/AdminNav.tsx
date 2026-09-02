"use client";

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  IconBook,
  IconBox,
  IconChevron,
  IconClipboard,
  IconGauge,
  IconInbox,
  IconSettings,
  IconShield,
  IconTrophy,
  IconUsers,
} from "@/components/admin/icons";
import type { RoleValue } from "@/lib/validation";

const CATALOGO: RoleValue[] = ["ADMIN", "EDITOR"];
const RH: RoleValue[] = ["ADMIN", "GESTOR_RH"];
const BACKOFFICE: RoleValue[] = ["ADMIN", "GESTOR_RH", "EDITOR"];
const SO_ADMIN: RoleValue[] = ["ADMIN"];
const TODOS: RoleValue[] = ["ADMIN", "GESTOR_RH", "EDITOR", "COLABORADOR"];

type IconComponent = (props: { className?: string }) => ReactElement;

type NavItem = {
  href: string;
  label: string;
  /** Only rendered at top level — children are indented text on a rail instead. */
  icon: IconComponent;
  exact?: boolean;
  roles: RoleValue[];
};

type Group = {
  id: string;
  label: string;
  icon: IconComponent;
  children: NavItem[];
};

type Entrada = NavItem | Group;

const isGroup = (entrada: Entrada): entrada is Group => "children" in entrada;

/**
 * Grouped rather than flat: the award/HR feature added six destinations that
 * each looked, from the sidebar, as important as "Produtos". They are one job —
 * running the team — so they live behind one entry that opens.
 *
 * `roles` mirrors the server-side guard for each destination — hiding a link
 * the page would let through is theatre, so the two are kept in step. A group
 * whose children are all hidden disappears; one left with a single child
 * collapses into a plain link, so a COLABORADOR sees "A minha atividade" and
 * nothing else rather than a group of one.
 */
const NAV: Entrada[] = [
  { href: "/admin", label: "Painel", icon: IconGauge, exact: true, roles: BACKOFFICE },
  {
    id: "catalogo",
    label: "Catálogo",
    icon: IconBox,
    children: [
      { href: "/admin/products", label: "Produtos", icon: IconBox, roles: CATALOGO },
      { href: "/admin/case-studies", label: "Casos de Estudo", icon: IconBook, roles: CATALOGO },
      { href: "/admin/quotes", label: "Orçamentos", icon: IconInbox, roles: CATALOGO },
    ],
  },
  {
    id: "equipa",
    label: "Equipa",
    icon: IconUsers,
    // Daily first, monthly second, setup last — the order someone actually
    // touches these in.
    children: [
      { href: "/equipa", label: "A minha atividade", icon: IconClipboard, roles: TODOS },
      { href: "/admin/folhas", label: "Folhas de atividade", icon: IconClipboard, roles: RH },
      { href: "/admin/premios", label: "Prémios", icon: IconTrophy, roles: RH },
      {
        href: "/admin/premios/historico",
        label: "Histórico de prémios",
        icon: IconTrophy,
        roles: RH,
      },
      { href: "/admin/colaboradores", label: "Colaboradores", icon: IconUsers, roles: RH },
      { href: "/admin/organizacao", label: "Organização", icon: IconSettings, roles: RH },
      // "Parâmetros do prémio" rather than "Definições": /admin/settings already
      // owns that label under Sistema, and two "Definições" in one sidebar is a
      // coin toss for whoever is looking for the award weights.
      {
        href: "/admin/premios/definicoes",
        label: "Parâmetros do prémio",
        icon: IconSettings,
        roles: SO_ADMIN,
      },
      { href: "/admin/team", label: "Contas e acessos", icon: IconShield, roles: SO_ADMIN },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: IconSettings,
    children: [
      { href: "/admin/settings", label: "Definições", icon: IconSettings, roles: CATALOGO },
      { href: "/admin/audit", label: "Auditoria", icon: IconShield, roles: SO_ADMIN },
    ],
  },
];

type Props = {
  /** "sidebar" stacks links vertically; "bar" lays them out as a scrollable pill row. */
  variant?: "sidebar" | "bar";
  /** Number of quote requests with status NEW, shown as a badge on "Orçamentos". */
  newQuotes?: number;
  role?: RoleValue;
};

function CountBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px] font-semibold",
        active ? "bg-a-accent-soft text-a-on-accent-soft" : "bg-lumen/15 text-lumen-deep",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Filters by role, then flattens any group left with fewer than two children. */
function visiveis(role: RoleValue): Entrada[] {
  return NAV.flatMap<Entrada>((entrada) => {
    if (!isGroup(entrada)) return entrada.roles.includes(role) ? [entrada] : [];

    const children = entrada.children.filter((child) => child.roles.includes(role));
    if (children.length === 0) return [];
    if (children.length === 1) return [{ ...children[0]!, icon: entrada.icon }];
    return [{ ...entrada, children }];
  });
}

function folhas(entradas: Entrada[]): NavItem[] {
  return entradas.flatMap((entrada) => (isGroup(entrada) ? entrada.children : [entrada]));
}

export function AdminNav({ variant = "sidebar", newQuotes = 0, role = "COLABORADOR" }: Props) {
  const pathname = usePathname();

  const entradas = visiveis(role);

  // Most specific match wins, so /admin/premios/definicoes highlights "Parâmetros
  // do prémio" alone and not also "Prémios", which is a prefix of it.
  const ativo = folhas(entradas)
    .filter((item) => (item.exact ? pathname === item.href : pathname.startsWith(item.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];

  // Explicit open/closed choices only. A group with no entry here falls back to
  // "open if the current page is inside it", which is both the sensible default
  // and identical on the server and the client, so nothing flickers on hydration.
  const [alternados, setAlternados] = useState<Record<string, boolean>>({});

  const estaAberto = (grupo: Group) =>
    alternados[grupo.id] ?? grupo.children.some((child) => child.href === ativo?.href);

  const alternar = (grupo: Group) =>
    setAlternados((prev) => ({ ...prev, [grupo.id]: !estaAberto(grupo) }));

  const badge = (href: string) => (href === "/admin/quotes" ? newQuotes : 0);
  const isAtivo = (item: NavItem) => item.href === ativo?.href;

  // Mobile keeps every destination one tap away: nesting a group inside a
  // horizontal scroller would hide links behind an extra tap for no gain.
  if (variant === "bar") {
    return (
      <nav aria-label="Administração" className="flex gap-1.5 overflow-x-auto pb-1">
        {folhas(entradas).map((item) => {
          const active = isAtivo(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-a-accent/30 bg-a-accent-soft text-a-text"
                  : "border-a-line text-a-muted hover:border-a-line-strong hover:text-a-text",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {badge(item.href) > 0 && <CountBadge count={badge(item.href)} active={active} />}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Administração" className="space-y-1">
      {entradas.map((entrada) => {
        if (!isGroup(entrada)) {
          const active = isAtivo(entrada);
          return (
            <Link
              key={entrada.href}
              href={entrada.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-a-accent-soft text-a-text"
                  : "text-a-muted hover:bg-a-hover hover:text-a-text",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-a-accent"
                />
              )}
              <entrada.icon
                className={cn(
                  "h-4.5 w-4.5 transition-colors",
                  active ? "text-a-accent" : "text-a-faint group-hover:text-a-accent",
                )}
              />
              {entrada.label}
              {badge(entrada.href) > 0 && (
                <span className="ml-auto">
                  <CountBadge count={badge(entrada.href)} active={active} />
                </span>
              )}
            </Link>
          );
        }

        const aberto = estaAberto(entrada);
        const contemAtivo = entrada.children.some((child) => child.href === ativo?.href);
        // Collapsed, the group has to answer for its children: it carries their
        // unread count and shows that the current page is inside it.
        const porVer = entrada.children.reduce((total, child) => total + badge(child.href), 0);

        return (
          <div key={entrada.id}>
            <button
              type="button"
              onClick={() => alternar(entrada)}
              aria-expanded={aberto}
              aria-controls={`nav-grupo-${entrada.id}`}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                contemAtivo && !aberto
                  ? "bg-a-hover text-a-text"
                  : "text-a-muted hover:bg-a-hover hover:text-a-text",
              )}
            >
              {contemAtivo && !aberto && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-a-accent"
                />
              )}
              <entrada.icon
                className={cn(
                  "h-4.5 w-4.5 transition-colors",
                  contemAtivo ? "text-a-accent" : "text-a-faint group-hover:text-a-accent",
                )}
              />
              {entrada.label}
              <span className="ml-auto flex items-center gap-1.5">
                {!aberto && porVer > 0 && <CountBadge count={porVer} active={false} />}
                <IconChevron
                  className={cn(
                    "h-4 w-4 text-a-faint transition-transform duration-200",
                    aberto && "rotate-180",
                  )}
                />
              </span>
            </button>

            {aberto && (
              <ul
                id={`nav-grupo-${entrada.id}`}
                className="mt-0.5 mb-1 ml-6 space-y-0.5 border-l border-a-line-strong pl-3"
              >
                {entrada.children.map((child) => {
                  const active = isAtivo(child);
                  return (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-a-accent-soft font-semibold text-a-text"
                            : "text-a-muted hover:bg-a-hover hover:text-a-text",
                        )}
                      >
                        {active && (
                          <span
                            aria-hidden
                            className="absolute -left-[13px] top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-a-accent"
                          />
                        )}
                        {child.label}
                        {badge(child.href) > 0 && (
                          <span className="ml-auto">
                            <CountBadge count={badge(child.href)} active={active} />
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}
