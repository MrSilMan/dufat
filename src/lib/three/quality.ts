export type QualityTier = "high" | "low";

/**
 * Coarse device-capability heuristic so the hero scene can degrade
 * gracefully (fewer particles, no skyline) on mid/low-end hardware.
 */
export function detectQuality(): QualityTier {
  if (typeof window === "undefined") return "low";

  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent);

  if (isMobile) return "low";
  if (cores <= 4 || memory <= 4) return "low";
  return "high";
}
