import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * "Os meus" / "Da equipa", for someone granted both. With only one grant there
 * is nothing to switch between, so nothing is rendered.
 */
export function SeparadoresRelatorios({
  ativo,
  registar,
  ver,
}: {
  ativo: "meus" | "equipa";
  registar: boolean;
  ver: boolean;
}) {
  if (!registar || !ver) return null;

  const separadores = [
    { id: "meus", href: "/equipa/relatorios", label: "Os meus relatórios" },
    { id: "equipa", href: "/equipa/relatorios/equipa", label: "Relatórios da equipa" },
  ] as const;

  return (
    <nav aria-label="Relatórios" className="flex flex-wrap gap-2">
      {separadores.map((separador) => (
        <Link
          key={separador.id}
          href={separador.href}
          aria-current={separador.id === ativo ? "page" : undefined}
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
            separador.id === ativo
              ? "border-a-accent/30 bg-a-accent-soft text-a-text"
              : "border-a-line text-a-muted hover:border-a-line-strong hover:text-a-text",
          )}
        >
          {separador.label}
        </Link>
      ))}
    </nav>
  );
}
