import type { TurntableVariant } from "./streetLightAssets";

/**
 * Which 3D showcase model represents each catalog category. Server-safe:
 * type-only import, no Three.js at runtime.
 */
export const SHOWCASE_VARIANT_BY_CATEGORY: Record<string, TurntableVariant> = {
  "iluminacao-publica": "head",
  "postes-e-bracos": "full",
  "iluminacao-decorativa": "bollard",
  "acessorios-eletricos": "accessories",
};
