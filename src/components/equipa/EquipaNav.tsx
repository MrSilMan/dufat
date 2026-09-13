"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { IconClipboard, IconGauge, IconReceipt, IconTrophy } from "@/components/admin/icons";

export type Aba = {
  href: string;
  label: string;
  /** Shorter label for the bottom bar, where 360px is the budget. */
  curto: string;
  icon: (props: { className?: string }) => React.ReactElement;
  exact: boolean;
  /** Only for people the admin gave access to the daily reports. */
  soComRelatorios?: boolean;
};

export const ABAS: Aba[] = [
  { href: "/equipa", label: "Início", curto: "Início", icon: IconGauge, exact: true },
  { href: "/equipa/registos", label: "Registos", curto: "Registos", icon: IconClipboard, exact: false },
  { href: "/equipa/premios", label: "A minha pontuação", curto: "Pontuação", icon: IconTrophy, exact: false },
  {
    href: "/equipa/relatorios",
    label: "Vendas e despesas",
    curto: "Caixa",
    icon: IconReceipt,
    exact: false,
    soComRelatorios: true,
  },
];

/** The tabs this person gets — without report access the feature is not even named. */
export function abasVisiveis(comRelatorios: boolean): Aba[] {
  return ABAS.filter((aba) => comRelatorios || !aba.soComRelatorios);
}

export function abaAtiva(pathname: string, aba: Aba): boolean {
  return aba.exact ? pathname === aba.href : pathname.startsWith(aba.href);
}

/**
 * Desktop tabs, in the header.
 *
 * The phone gets `EquipaTabBar` at the bottom instead — the same
 * destinations, moved into thumb reach.
 */
export function EquipaNav({ comRelatorios }: { comRelatorios: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Área da equipa" className="flex gap-1.5">
      {abasVisiveis(comRelatorios).map((aba) => {
        const ativa = abaAtiva(pathname, aba);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              ativa
                ? "border-a-accent/30 bg-a-accent-soft text-a-text"
                : "border-a-line text-a-muted hover:border-a-line-strong hover:text-a-text",
            )}
          >
            <aba.icon className="h-4 w-4" />
            {aba.label}
          </Link>
        );
      })}
    </nav>
  );
}
