import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { RoleValue } from "@/lib/validation";

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
  /** Small label above the title. The employee area is not "Administração". */
  eyebrow?: string;
};

export function PageHeader({
  title,
  description,
  backHref,
  backLabel,
  action,
  eyebrow = "Administração",
}: PageHeaderProps) {
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
          {eyebrow}
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

/**
 * Standard edit-form shell: the record's own data in the main column, and how
 * it is presented (publication, image) in a sidebar that follows the scroll.
 */
export function FormLayout({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
      <div className="space-y-6">{children}</div>
      <aside className="space-y-6 xl:sticky xl:top-6">{aside}</aside>
    </div>
  );
}

/** Stacked list of {@link SwitchRow}s, hairline-separated. */
export function SwitchGroup({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="-my-1 divide-y divide-a-line">
      <legend className="sr-only">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** One row of a settings list: label, hint and a switch. */
export function SwitchRow({
  name,
  label,
  hint,
  checked,
  defaultChecked,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl px-1 py-2 transition-colors hover:bg-a-hover">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-a-text">{label}</span>
        <span className="mt-0.5 block text-xs text-a-faint">{hint}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
        className="sr-only"
      />
      <span aria-hidden className="admin-switch" />
    </label>
  );
}

/** Sticky bottom bar carrying the form-level error, cancel link and submit. */
export function FormActions({
  error,
  cancelHref,
  cancelLabel = "Cancelar",
  submitLabel,
  pending,
}: {
  error?: string;
  cancelHref: string;
  cancelLabel?: string;
  submitLabel: string;
  pending?: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-20 -mx-1 mt-6 px-1 pb-1">
      <div className="card-admin flex flex-wrap items-center justify-between gap-3 px-4 py-3 backdrop-blur">
        <p role="alert" className="min-w-0 text-sm text-rose-500">
          {error ?? ""}
        </p>
        <div className="ml-auto flex items-center gap-3">
          <Link href={cancelHref} className="btn-admin-ghost">
            {cancelLabel}
          </Link>
          <button type="submit" disabled={pending} className="btn-admin px-7">
            {pending ? "A guardar…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
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

const roleStyles: Record<RoleValue, { label: string; className: string }> = {
  ADMIN: { label: "Administrador", className: "badge-accent" },
  GESTOR_RH: { label: "Gestor de RH", className: "badge-warm" },
  EDITOR: { label: "Editor", className: "badge-neutral" },
  COLABORADOR: { label: "Colaborador", className: "badge-neutral" },
};

export function RoleBadge({ role }: { role: RoleValue }) {
  const style = roleStyles[role] ?? roleStyles.COLABORADOR;
  return (
    <span className={cn(badgeBase, style.className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {style.label}
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
