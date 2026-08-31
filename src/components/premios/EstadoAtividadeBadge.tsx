import { cn } from "@/lib/cn";

const estilos: Record<string, { label: string; className: string }> = {
  RASCUNHO: { label: "Rascunho", className: "badge-neutral" },
  SUBMETIDA: { label: "Submetida", className: "badge-accent" },
  VALIDADA: { label: "Validada", className: "badge-success" },
  EM_JUSTIFICACAO: { label: "Em justificação", className: "badge-warm" },
  JUSTIFICADA: { label: "Justificada", className: "badge-warm" },
  REJEITADA: { label: "Rejeitada", className: "badge-danger" },
};

const estilosFolha: Record<string, { label: string; className: string }> = {
  ABERTA: { label: "Aberta", className: "badge-neutral" },
  SUBMETIDA: { label: "Submetida", className: "badge-accent" },
  FECHADA: { label: "Fechada", className: "badge-success" },
};

const base =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

export function EstadoAtividadeBadge({ estado }: { estado: string }) {
  const estilo = estilos[estado] ?? estilos.RASCUNHO;
  return (
    <span className={cn(base, estilo.className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {estilo.label}
    </span>
  );
}

export function EstadoFolhaBadge({ estado }: { estado: string }) {
  const estilo = estilosFolha[estado] ?? estilosFolha.ABERTA;
  return (
    <span className={cn(base, estilo.className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {estilo.label}
    </span>
  );
}
