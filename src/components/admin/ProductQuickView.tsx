"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { unsyncProductFromInvgest } from "@/server/actions/admin";
import { DangerSubmit } from "@/components/admin/DangerSubmit";
import { IconBox, IconExternal, IconImage } from "@/components/admin/icons";

export type QuickViewProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  modelCode: string | null;
  categoryName: string;
  shortDescription: string;
  heroImage: string | null;
  /** Preformatted on the server — Decimal doesn't cross the client boundary. */
  price: string;
  wattage: number | null;
  lumens: number | null;
  featured: boolean;
  published: boolean;
  has3dViewer: boolean;
  invgestItemCode: string | null;
  imported: boolean;
  createdAt: string;
  updatedAt: string;
  specs: { group: string; label: string; value: string }[];
};

const DETACH_CONFIRM =
  "Desassociar este produto da INVGEST?\n\nO produto permanece no site — deixa apenas de ser atualizado nas próximas importações. O artigo na INVGEST não é afetado.";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.7rem] font-medium uppercase tracking-wider text-a-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-a-text">{value}</dd>
    </div>
  );
}

function Tag({ children, tone }: { children: React.ReactNode; tone: "on" | "off" | "accent" }) {
  const styles = {
    on: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
    off: "border-a-line-strong bg-a-hover text-a-muted",
    accent: "border-a-accent/35 bg-a-accent-soft text-a-on-accent-soft",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}

/**
 * Clickable product cell on the admin list that opens a read-only detail modal.
 * Uses a native <dialog>, so Esc, the focus trap and the top layer come free.
 */
export function ProductQuickView({
  product,
  canDetach,
}: {
  product: QuickViewProduct;
  canDetach: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Clicking the backdrop lands on the <dialog> itself; inner content stops there.
  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) setOpen(false);
  };

  const groups = product.specs.reduce<Record<string, { label: string; value: string }[]>>(
    (acc, spec) => {
      (acc[spec.group] ??= []).push({ label: spec.label, value: spec.value });
      return acc;
    },
    {},
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3.5 rounded-xl p-1 text-left transition-colors hover:bg-a-hover"
        aria-haspopup="dialog"
      >
        {product.heroImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.heroImage}
            alt=""
            className="h-11 w-14 shrink-0 rounded-lg border border-a-line bg-a-inset object-cover"
          />
        ) : (
          <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-a-line-strong text-a-faint">
            <IconBox className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block font-semibold text-a-text group-hover:text-a-accent">{product.name}</span>
          <span className="block font-mono text-xs text-a-faint">{product.slug}</span>
        </span>
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={onBackdropClick}
        aria-labelledby={`qv-${product.id}-title`}
        className="admin-dialog"
      >
        {open && (
          <div className="flex max-h-[inherit] flex-col">
            <header className="flex items-start gap-4 border-b border-a-line px-6 py-5">
              <div className="min-w-0 flex-1">
                <h2 id={`qv-${product.id}-title`} className="font-display text-lg font-bold text-a-text">
                  {product.name}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-a-faint">{product.slug}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn-admin-icon" aria-label="Fechar">
                <span aria-hidden className="text-lg leading-none">
                  ×
                </span>
              </button>
            </header>

            <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              <div>
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-a-line bg-a-inset p-3">
                  {product.heroImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.heroImage}
                      alt={product.name}
                      // Whole image, never cropped — same rule as the edit form.
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="flex flex-col items-center gap-2 text-a-faint">
                      <IconImage className="h-6 w-6" />
                      <span className="text-xs">Sem imagem</span>
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Tag tone={product.published ? "on" : "off"}>
                    {product.published ? "Publicado" : "Rascunho"}
                  </Tag>
                  {product.featured && <Tag tone="accent">Destaque</Tag>}
                  {product.has3dViewer && <Tag tone="accent">Visualizador 3D</Tag>}
                  {product.imported && (
                    <Tag tone="on">INVGEST{product.invgestItemCode ? ` · ${product.invgestItemCode}` : ""}</Tag>
                  )}
                </div>

                {product.shortDescription && (
                  <p className="mt-4 text-sm leading-relaxed text-a-muted">{product.shortDescription}</p>
                )}
              </div>

              <div className="space-y-5">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <Fact label="Categoria" value={product.categoryName} />
                  <Fact label="Preço" value={product.price} />
                  <Fact label="SKU" value={product.sku ?? "—"} />
                  <Fact label="Código do modelo" value={product.modelCode ?? "—"} />
                  <Fact label="Potência" value={product.wattage ? `${product.wattage} W` : "—"} />
                  <Fact label="Fluxo" value={product.lumens ? `${product.lumens} lm` : "—"} />
                  <Fact label="Criado" value={product.createdAt} />
                  <Fact label="Atualizado" value={product.updatedAt} />
                </dl>

                {Object.entries(groups).map(([group, rows]) => (
                  <div key={group}>
                    <p className="text-[0.7rem] font-medium uppercase tracking-wider text-a-faint">{group}</p>
                    <dl className="mt-1.5 divide-y divide-a-line rounded-xl border border-a-line">
                      {rows.map((row, index) => (
                        <div key={`${row.label}-${index}`} className="flex gap-4 px-3 py-2 text-sm">
                          <dt className="min-w-0 flex-1 text-a-muted">{row.label}</dt>
                          <dd className="shrink-0 text-right text-a-text">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-a-line px-6 py-4">
              {product.imported && canDetach ? (
                <form action={unsyncProductFromInvgest}>
                  <input type="hidden" name="id" value={product.id} />
                  <DangerSubmit
                    confirmMessage={DETACH_CONFIRM}
                    className="text-xs text-a-faint underline-offset-2 transition-colors hover:text-rose-500 hover:underline"
                  >
                    Desassociar da INVGEST
                  </DangerSubmit>
                </form>
              ) : (
                <span />
              )}
              <div className="ml-auto flex items-center gap-3">
                {product.published && (
                  <Link href={`/products/${product.slug}`} target="_blank" className="btn-admin-ghost">
                    <IconExternal className="h-4 w-4" />
                    Ver no site
                  </Link>
                )}
                <Link href={`/admin/products/${product.id}/edit`} className="btn-admin">
                  Editar produto
                </Link>
              </div>
            </footer>
          </div>
        )}
      </dialog>
    </>
  );
}
