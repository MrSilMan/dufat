"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { IconPlus } from "@/components/admin/icons";
import { ABAS, abaAtiva } from "@/components/equipa/EquipaNav";

/**
 * Bottom navigation for the phone.
 *
 * Three destinations plus the one action people come here to do. "Registar" is
 * an action rather than a fourth tab because it is a form you finish and leave,
 * not a place you stay — it opens as a sheet over whatever you were reading,
 * and closing it puts you back where you were.
 *
 * Hidden from `md:` up, where the header tabs take over.
 */
export function EquipaTabBar({ podeRegistar }: { podeRegistar: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação"
      className="equipa-tabbar admin-chrome fixed inset-x-0 bottom-0 z-40 border-t border-a-line md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {ABAS.map((aba, indice) => {
          const ativa = abaAtiva(pathname, aba);
          const item = (
            <li key={aba.href} className="flex-1">
              <Link
                href={aba.href}
                aria-current={ativa ? "page" : undefined}
                className={cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[0.68rem] font-medium transition-colors",
                  ativa ? "text-a-accent" : "text-a-muted active:bg-a-hover",
                )}
              >
                <aba.icon className={cn("h-5 w-5", ativa && "text-a-accent")} />
                <span className="truncate">{aba.curto}</span>
              </Link>
            </li>
          );

          // The action sits in the middle, where the thumb already is.
          if (indice !== 1 || !podeRegistar) return item;
          return [
            item,
            <li key="registar" className="flex-1">
              <Link
                href={{ pathname, query: { registar: "1" } }}
                scroll={false}
                className="flex min-h-[52px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-[0.68rem] font-semibold text-a-accent"
              >
                <span
                  aria-hidden
                  className="flex h-8 w-11 items-center justify-center rounded-full bg-linear-to-br from-dufat-bright to-dufat text-white shadow-[0_8px_18px_-8px_rgba(45,119,201,0.9)]"
                >
                  <IconPlus className="h-5 w-5" />
                </span>
                <span className="truncate">Registar</span>
              </Link>
            </li>,
          ];
        })}
      </ul>
    </nav>
  );
}
