export type QualityTier = "high" | "low";

type NavigatorHints = Navigator & {
  deviceMemory?: number;
  connection?: { effectiveType?: string; saveData?: boolean };
};

function hints(): NavigatorHints {
  return navigator as NavigatorHints;
}

/** True when the visitor has asked for, or is on, a genuinely constrained link. */
function onConstrainedNetwork(nav: NavigatorHints): boolean {
  const connection = nav.connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  // effectiveType is dominated by round-trip time, and Angolan links report
  // "3g" at perfectly usable bandwidth — only 2g is genuinely too slow.
  return /(^|-)2g$/.test(connection.effectiveType ?? "");
}

/**
 * Coarse device-capability heuristic for the scene's *fidelity* knobs:
 * antialiasing, pixel ratio, star and particle counts. These are the real
 * per-frame costs — pixel ratio alone is quadratic in fragment work — so the
 * thresholds here stay conservative.
 *
 * This deliberately does NOT decide whether the city loads; see
 * shouldLoadSkyline(). Bundling the two meant a mid-range laptop gave up the
 * entire skyline in order to save antialiasing.
 */
export function detectQuality(): QualityTier {
  if (typeof window === "undefined") return "low";

  const nav = hints();
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(nav.userAgent);

  if (onConstrainedNetwork(nav)) return "low";
  if (isMobile) return "low";
  if (cores <= 4 || memory <= 4) return "low";
  return "high";
}

/**
 * Whether to download and render skyline_far — the lit city behind the lamp.
 *
 * This is *content*, not polish: without it the hero is a lamp against empty
 * ground, which reads as an unfinished page rather than a lighter one. It used
 * to ride on detectQuality() because the asset was 24 MB and the download was
 * the binding constraint. Post-compression it is 2.8 MB of static, quantised
 * geometry, so the bar is now only "will this device cope at all" — a device
 * that cannot afford 25 static meshes cannot afford the lamp either.
 *
 * Devices below the fidelity bar still get the city, just at pixel ratio 1.25
 * with antialiasing off and fewer particles.
 *
 * Note: `deviceMemory` is reported rounded down to a power of two and capped at
 * 8, so a 6 GB machine reports 4. That is why it is not a threshold here.
 */
export function shouldLoadSkyline(): boolean {
  if (typeof window === "undefined") return false;

  const nav = hints();
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;

  if (onConstrainedNetwork(nav)) return false;
  // Bottom-end hardware only: dual-core, or ≤2 GB reported.
  return cores > 2 && memory > 2;
}
