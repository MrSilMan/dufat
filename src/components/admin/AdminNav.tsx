"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  IconBook,
  IconBox,
  IconGauge,
  IconInbox,
  IconSettings,
  IconShield,
  IconUsers,
} from "@/components/admin/icons";

/** `adminOnly` links are hidden from editors; the pages guard themselves too. */
const items = [
  { href: "/admin", label: "Painel", icon: IconGauge, exact: true, adminOnly: false },
  { href: "/admin/products", label: "Produtos", icon: IconBox, exact: false, adminOnly: false },
  { href: "/admin/case-studies", label: "Casos de Estudo", icon: IconBook, exact: false, adminOnly: false },
  { href: "/admin/quotes", label: "Orçamentos", icon: IconInbox, exact: false, adminOnly: false },
  { href: "/admin/settings", label: "Definições", icon: IconSettings, exact: false, adminOnly: false },
  { href: "/admin/team", label: "Equipa", icon: IconUsers, exact: false, adminOnly: true },
  { href: "/admin/audit", label: "Auditoria", icon: IconShield, exact: false, adminOnly: true },
];

type Props = {
  /** "sidebar" stacks links vertically; "bar" lays them out as a scrollable pill row. */
  variant?: "sidebar" | "bar";
  /** Number of quote requests with status NEW, shown as a badge on "Orçamentos". */
  newQuotes?: number;
  role?: "ADMIN" | "EDITOR";
};

function CountBadge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cn(
        "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px] font-semibold",
        active ? "bg-a-accent-soft text-a-on-accent-soft" : "bg-lumen/15 text-lumen-deep",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AdminNav({ variant = "sidebar", newQuotes = 0, role = "EDITOR" }: Props) {
  const pathname = usePathname();

  const visible = items.filter((item) => !item.adminOnly || role === "ADMIN");

  const isActive = (item: (typeof items)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  if (variant === "bar") {
    return (
      <nav aria-label="Administração" className="flex gap-1.5 overflow-x-auto pb-1">
        {visible.map((item) => {
          const active = isActive(item);
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
              {item.href === "/admin/quotes" && newQuotes > 0 && (
                <CountBadge count={newQuotes} active={active} />
              )}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Administração" className="space-y-1">
      {visible.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
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
            <item.icon
              className={cn(
                "h-4.5 w-4.5 transition-colors",
                active ? "text-a-accent" : "text-a-faint group-hover:text-a-accent",
              )}
            />
            {item.label}
            {item.href === "/admin/quotes" && newQuotes > 0 && (
              <CountBadge count={newQuotes} active={active} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
