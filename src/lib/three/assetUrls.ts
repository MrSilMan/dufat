/**
 * Designer-delivered GLB asset URLs (served from public/dufat-3d-assets).
 * Kept in a module with no three.js imports so pages can reference them for
 * preloading without pulling the 3D bundle into first load.
 *
 * The `.vN` suffix is load-bearing: next.config.ts serves this directory with
 * `immutable, max-age=1y`, so a re-delivered asset MUST take a new filename or
 * returning visitors keep the cached copy forever. Bump the suffix whenever
 * scripts/optimize-glb.mjs is re-run against new designer source files.
 */
export const STREET_LIGHT_URL = "/dufat-3d-assets/candeeiro.v2.glb";
export const SKYLINE_URL = "/dufat-3d-assets/skyline_far.v2.glb";
