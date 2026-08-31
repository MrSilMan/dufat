/**
 * Compresses the designer-delivered GLBs for the web.
 *
 * The uncompressed masters are deliberately NOT kept in public/ — anything in
 * that directory is published and swept into the build. Drop the delivery in
 * as public/dufat-3d-assets/<name>.glb, run `node scripts/optimize-glb.mjs`,
 * then delete the master again. The previous masters are recoverable from git:
 *   git show b840c38:public/dufat-3d-assets/candeeiro.glb > candeeiro.glb
 *
 * The source files ship raw: 32.2 MB across the two, 27.9 MB of which is
 * textures at up to 16-bit RGBA PNG. That gated the hero loader ("A preparar a
 * luz…") behind a ~50 s download on a typical Angolan connection. Resizing to
 * 1K, re-encoding to WebP and quantising geometry takes it to ~3.2 MB.
 *
 * IMPORTANT — do not replace this with `gltf-transform optimize`. Its default
 * pipeline runs join / flatten / palette / prune, all of which rename or merge
 * nodes and materials. src/lib/three/streetLightAssets.ts looks these up by
 * exact name ("ledpanel", "Plástico Transparente", "Led Amarela", "Road",
 * "Ground", "Paviment") and throws outright when "ledpanel" is missing. The
 * three passes below are the ones verified not to touch the name table; the
 * assertion at the end of this script is what guarantees it.
 *
 * Outputs are written as `<name>.vN.glb`. The version suffix is required:
 * next.config.ts serves this directory `immutable, max-age=1y`, so reusing a
 * filename strands returning visitors on the old asset. Bump the per-source
 * `version` here and the URL in src/lib/three/assetUrls.ts together — only
 * for the asset whose pipeline settings changed, so returning visitors keep
 * their cached copy of the other one.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";

const ASSET_DIR = path.join(process.cwd(), "public", "dufat-3d-assets");
// The hero lamp is the product being sold and fills the frame, so it gets the
// higher texture quality; the skyline is set dressing seen through fog at
// distance. The split costs ~250 KB and keeps the LED diode grid crisp.
const SOURCES = [
  { name: "candeeiro", quality: 95, version: "v3" },
  {
    name: "skyline_far",
    quality: 85,
    version: "v4",
    // The tiled ground PBR sets (grass verge, road, paving, metal) were
    // ~1.7 MB of the 2.8 MB file at 1K, yet they repeat many times across the
    // terrain, so 512 px keeps their on-screen texel density fine at night.
    // The building facade textures ("Captura de ecrã …") are what the city
    // actually shows — they stay at the global ceiling above.
    downsize: { pattern: "{Grass005,Road007,PavingStones081,metal_0010}*", size: 512 },
  },
];

/** Names the runtime resolves by string — a rename here is a broken hero. */
function nameTable(file) {
  const buffer = readFileSync(file);
  const jsonLength = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.slice(20, 20 + jsonLength).toString());
  const names = (list) => (gltf[list] ?? []).map((entry) => entry.name).filter(Boolean).sort();
  return {
    nodes: names("nodes"),
    meshes: names("meshes"),
    materials: names("materials"),
    // The photocell cycle scales this baseline, so drift would change the look.
    emissive: Object.fromEntries(
      (gltf.materials ?? [])
        .filter((material) => material.extensions?.KHR_materials_emissive_strength)
        .map((material) => [
          material.name,
          material.extensions.KHR_materials_emissive_strength.emissiveStrength,
        ]),
    ),
  };
}

const cli = (...args) =>
  execFileSync("npx", ["--yes", "@gltf-transform/cli", ...args], { stdio: "inherit" });

for (const { name, quality, version, downsize } of SOURCES) {
  const source = path.join(ASSET_DIR, `${name}.glb`);
  const output = path.join(ASSET_DIR, `${name}.${version}.glb`);
  const stepA = path.join(ASSET_DIR, `${name}.step-a.tmp.glb`);
  const stepB = path.join(ASSET_DIR, `${name}.step-b.tmp.glb`);

  try {
    // 1K is the ceiling anything reaches on screen; several sources were larger.
    cli("resize", source, stepA, "--width", "1024", "--height", "1024");
    if (downsize) {
      // Second, tighter pass for textures that can afford it (see SOURCES).
      cli(
        "resize", stepA, stepA,
        "--pattern", downsize.pattern,
        "--width", String(downsize.size),
        "--height", String(downsize.size),
      );
    }
    // The big one: 16-bit RGBA PNG normal maps are ~124x their WebP equivalent.
    cli("webp", stepA, stepB, "--quality", String(quality));
    // Quantised + meshopt geometry. GLTFLoader needs MeshoptDecoder for this,
    // wired up in streetLightAssets.ts — it is in extensionsRequired.
    cli("meshopt", stepB, output);
  } finally {
    rmSync(stepA, { force: true });
    rmSync(stepB, { force: true });
  }

  const before = nameTable(source);
  const after = nameTable(output);
  for (const list of ["nodes", "meshes", "materials"]) {
    const missing = before[list].filter((entry) => !after[list].includes(entry));
    if (missing.length > 0) {
      throw new Error(`${name}: optimizer dropped ${list}: ${missing.join(", ")}`);
    }
  }
  if (JSON.stringify(before.emissive) !== JSON.stringify(after.emissive)) {
    throw new Error(`${name}: KHR_materials_emissive_strength changed`);
  }
  console.log(`${name}: name table intact -> ${path.basename(output)}`);
}
