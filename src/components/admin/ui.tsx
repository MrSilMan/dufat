import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Themeable input class for every admin form control. */
export const adminInputClass = "admin-input";

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */

type PageHeaderProps = {
  title: string;
  description?: string;
  /** Optional back link rendered above the title. */
  backHref?: string;
  backLabel?: string;
  /** Right-aligned action (button/link). */
  action?: ReactNode;
};

export function PageHeader({ title, description, backHref, backLabel, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-a-muted transition-colors hover:text-a-accent"
          >
            <span aria-hidden>←</span>
            {backLabel ?? "Voltar"}
          </Link>
        )}
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.28em] text-a-accent">
          Administração
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-black text-a-text md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm text-a-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form building blocks                                                */
/* ------------------------------------------------------------------ */

type AdminFieldProps = {
  label: string;
  htmlFor: string;
  errors?: string[];
  children: ReactNode;
  optional?: boolean;
  hint?: string;
};

export function AdminField({ label, htmlFor, errors, children, optional, hint }: AdminFieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-a-text">
        {label}
        {optional && <span className="ml-1.5 text-xs font-normal text-a-faint">(opcional)</span>}
      </label>
      {children}
      {hint && !errors?.[0] && <p className="mt-1.5 text-xs text-a-faint">{hint}</p>}
      {errors?.[0] && (
        <p role="alert" className="mt-1.5 text-xs text-rose-500">
          {errors[0]}
        </p>
      )}
    </div>
  );
}

type FormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

/** Groups related fields into a titled admin card. */
export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="card-admin p-6">
      <div className="mb-5 border-b border-a-line pb-4">
        <h2 className="font-display text-base font-bold text-a-text">{title}</h2>
        {description && <p className="mt-1 text-sm text-a-muted">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

const badgeBase =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium";

const quoteStatusStyles: Record<string, { label: string; className: string }> = {
  NEW: { label: "Novo", className: "badge-accent" },
  IN_PROGRESS: { label: "Em curso", className: "badge-warm" },
  WON: { label: "Ganho", className: "badge-success" },
  CLOSED: { label: "Fechado", className: "badge-neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = quoteStatusStyles[status] ?? quoteStatusStyles.CLOSED;
  return (
    <span className={cn(badgeBase, style.className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {style.label}
    </span>
  );
}

export function PublishBadge({ published }: { published: boolean }) {
  return (
    <span className={cn(badgeBase, published ? "badge-success" : "badge-neutral")}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {published ? "Publicado" : "Rascunho"}
    </span>
  );
}

export function RoleBadge({ role }: { role: "ADMIN" | "EDITOR" }) {
  return (
    <span className={cn(badgeBase, role === "ADMIN" ? "badge-accent" : "badge-neutral")}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {role === "ADMIN" ? "Administrador" : "Editor"}
    </span>
  );
}

const inviteStatusStyles: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pendente", className: "badge-warm" },
  ACCEPTED: { label: "Aceite", className: "badge-success" },
  REVOKED: { label: "Revogado", className: "badge-neutral" },
};

export function InviteStatusBadge({ status }: { status: string }) {
  const style = inviteStatusStyles[status] ?? inviteStatusStyles.REVOKED;
  return (
    <span className={cn(badgeBase, style.className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {style.label}
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={cn(badgeBase, active ? "badge-success" : "badge-neutral")}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {active ? "Ativo" : "Desativado"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Row actions (shared by list pages)                                  */
/* ------------------------------------------------------------------ */

/** Small outlined "Editar" link used in table/list rows. */
export function RowEditLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-a-line px-3 py-1.5 text-xs font-medium text-a-muted transition-colors hover:border-a-line-strong hover:text-a-text"
    >
      Editar
    </Link>
  );
}

/** Small outlined destructive button style for row "Apagar" actions. */
export const rowDangerClass = "btn-row-danger";

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-a-line-strong text-a-faint">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-a-text">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-a-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
