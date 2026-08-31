import type { TurntableVariant } from "./streetLightAssets";

/**
 * Which 3D model represents a catalog entry. Server-safe: type-only import of
 * the Three.js module, so pages and server actions can reason about variants
 * without pulling the 3D bundle into the first load.
 */

/** Every variant a product can be staged with, in admin-menu order. */
export const TURNTABLE_VARIANTS = [
  "head",
  "full",
  "arm",
  "pole",
  "base",
  "door",
  "bollard",
  "accessories",
] as const;

/** Portuguese labels for the admin's model picker. */
export const TURNTABLE_VARIANT_LABELS: Record<TurntableVariant, string> = {
  head: "Luminária (cabeça ST89)",
  full: "Candeeiro completo",
  arm: "Braço",
  pole: "Poste",
  base: "Base / chumbadouro",
  door: "Portinhola de inspeção",
  bollard: "Balizador decorativo",
  accessories: "Kit de acessórios",
};

/**
 * Fallback model for a product that has the 3D viewer switched on but no model
 * of its own — the category's representative product.
 */
export const SHOWCASE_VARIANT_BY_CATEGORY: Record<string, TurntableVariant> = {
  "iluminacao-publica": "head",
  "postes-e-bracos": "full",
  "iluminacao-decorativa": "bollard",
  "acessorios-eletricos": "accessories",
};

/** Parts cut from candeeiro.glb that carry no LED panel. */
const UNLIT_VARIANTS: ReadonlySet<string> = new Set(["arm", "pole", "base", "door"]);

/** Whether a variant has a working LED (drives the viewer's ON/OFF switch). */
export function isLitVariant(variant: TurntableVariant): boolean {
  return !UNLIT_VARIANTS.has(variant);
}

export function isTurntableVariant(value: string): value is TurntableVariant {
  return (TURNTABLE_VARIANTS as readonly string[]).includes(value);
}

/**
 * The model to stage for a product, or null to show its photo instead.
 *
 * The 3D viewer is opt-in per product: without this gate every product in a
 * category with a model — including catalog items imported from INVGEST, like
 * lamps and power supplies — was rendered as a street light, hiding its own
 * image.
 */
export function resolveProductVariant(product: {
  has3dViewer: boolean;
  viewer3dVariant: string | null;
  category: { slug: string };
}): TurntableVariant | null {
  if (!product.has3dViewer) return null;
  if (product.viewer3dVariant && isTurntableVariant(product.viewer3dVariant)) {
    return product.viewer3dVariant;
  }
  return SHOWCASE_VARIANT_BY_CATEGORY[product.category.slug] ?? null;
}
