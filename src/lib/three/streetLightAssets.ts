import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SKYLINE_URL, STREET_LIGHT_URL } from "./assetUrls";

/**
 * Loaders + integration patches for the designer-delivered GLB assets:
 *
 *  - /dufat-3d-assets/candeeiro.glb    — the hero street light, six named parts
 *    (head / arm / pole / base / door / ledpanel), geometry world-baked in
 *    meters: pole base ~y0.42, luminaire head ~y8.5.
 *  - /dufat-3d-assets/skyline_far.glb  — full night environment: textured
 *    ground/road, emissive-window buildings (z −176…−852) and 18 instanced
 *    "DUFAT.*" street lights receding down the avenue.
 *
 * Export quirks patched here (the brief makes integration our job):
 *  - "Plástico Transparente" (the lens) exported with default PBR values —
 *    opaque, metallic 1 — which would hide the LED panel. Re-dressed as a
 *    frosted transparent cover.
 *  - "Led Amarela" ships KHR_materials_emissive_strength = 8; we capture that
 *    as the "full brightness" baseline so the photocell day/night cycle can
 *    scale it.
 *  - "Road" exported with roughness 1; lowered for the wet-asphalt night look.
 */

export { SKYLINE_URL, STREET_LIGHT_URL };

export const PART_NAMES = ["head", "arm", "pole", "base", "door"] as const;
export type PartName = (typeof PART_NAMES)[number];

export type StreetLightAsset = {
  root: THREE.Group;
  parts: Record<PartName, THREE.Object3D>;
  /** Emissive LED panel material — animated by the photocell cycle. */
  ledMaterial: THREE.MeshStandardMaterial;
  /** emissiveIntensity as authored (KHR emissive strength) = full brightness. */
  ledBaseIntensity: number;
  /** World-space bounding-box centres, used for annotation leader lines. */
  partAnchors: Record<PartName, THREE.Vector3>;
  /** Centre of the LED panel — origin for spotlight, halo and beam. */
  lampAnchor: THREE.Vector3;
};

export type EmissiveEntry = {
  material: THREE.MeshStandardMaterial;
  base: number;
};

export type SkylineAsset = {
  root: THREE.Group;
  /** "Led Amarela" instances in the skyline — distant lamp panels. */
  ledMaterials: EmissiveEntry[];
  /** Building window materials — dimmed as the night deepens/dawn breaks. */
  windowMaterials: EmissiveEntry[];
  /** World positions of every distant lamp's LED panel (halo sprites). */
  lampAnchors: THREE.Vector3[];
};

const loader = new GLTFLoader();

function isStandardMaterial(material: THREE.Material): material is THREE.MeshStandardMaterial {
  return (material as THREE.MeshStandardMaterial).isMeshStandardMaterial === true;
}

/** Every unique MeshStandardMaterial reachable from `root`. */
function collectMaterials(root: THREE.Object3D): Set<THREE.MeshStandardMaterial> {
  const found = new Set<THREE.MeshStandardMaterial>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (material && isStandardMaterial(material)) found.add(material);
    }
  });
  return found;
}

/** The lens exported opaque (default PBR) — re-dress as a frosted cover. */
function patchLensMaterial(material: THREE.MeshStandardMaterial): void {
  material.color.setHex(0xdde8f0);
  material.metalness = 0;
  material.roughness = 0.12;
  material.transparent = true;
  material.opacity = 0.28;
  material.depthWrite = false;
  material.needsUpdate = true;
}

function computeAnchor(object: THREE.Object3D): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(object);
  return box.isEmpty() ? object.getWorldPosition(new THREE.Vector3()) : box.getCenter(new THREE.Vector3());
}

/**
 * The arm is an L-shaped bracket (riser up the pole + beam out to the head),
 * so its bounding-box centre floats in the empty corner of the L. Drop a ray
 * onto the beam at the box's horizontal midpoint so the leader touches metal.
 */
function computeArmAnchor(arm: THREE.Object3D): THREE.Vector3 | null {
  const box = new THREE.Box3().setFromObject(arm);
  if (box.isEmpty()) return null;
  const centre = box.getCenter(new THREE.Vector3());
  const ray = new THREE.Raycaster(
    new THREE.Vector3(centre.x, box.max.y + 1, centre.z),
    new THREE.Vector3(0, -1, 0),
  );
  const hit = ray.intersectObject(arm, true)[0];
  return hit ? hit.point : null;
}

export async function loadStreetLight(): Promise<StreetLightAsset> {
  const gltf = await loader.loadAsync(STREET_LIGHT_URL);
  const root = gltf.scene;
  root.updateMatrixWorld(true);

  const parts = {} as Record<PartName, THREE.Object3D>;
  const partAnchors = {} as Record<PartName, THREE.Vector3>;
  for (const name of PART_NAMES) {
    const node = root.getObjectByName(name);
    if (!node) throw new Error(`candeeiro.glb: missing required mesh "${name}"`);
    parts[name] = node;
    partAnchors[name] = computeAnchor(node);
  }
  const armSurface = computeArmAnchor(parts.arm);
  if (armSurface) partAnchors.arm.copy(armSurface);

  const ledPanel = root.getObjectByName("ledpanel") as THREE.Mesh | undefined;
  if (!ledPanel?.isMesh) throw new Error(`candeeiro.glb: missing required mesh "ledpanel"`);
  const ledMaterial = ledPanel.material as THREE.MeshStandardMaterial;
  const lampAnchor = computeAnchor(ledPanel);

  for (const material of collectMaterials(root)) {
    if (material.name === "Plástico Transparente") {
      patchLensMaterial(material);
    } else if (material.name === "") {
      // One head primitive exported without a material — GLTFLoader gives it
      // a default bright-white standard material. Re-dress as dark plastic.
      material.color.setHex(0x111317);
      material.metalness = 0.1;
      material.roughness = 0.6;
    }
  }

  return {
    root,
    parts,
    ledMaterial,
    ledBaseIntensity: ledMaterial.emissiveIntensity,
    partAnchors,
    lampAnchor,
  };
}

export type TurntableVariant = "head" | "full" | "bollard" | "accessories";

export type TurntableAsset = {
  /** Model recentred at the origin, ready for a turntable pivot. */
  group: THREE.Group;
  ledMaterial: THREE.MeshStandardMaterial;
  /** emissiveIntensity as authored = full brightness (for LED on/off tweens). */
  ledBaseIntensity: number;
  /** Centre of the LED panel in the recentred local space (halo/spotlight origin). */
  lampAnchor: THREE.Vector3;
  /**
   * Where the model meets the ground in recentred space (light pool / contact
   * shadow): the world-origin vertical axis at the bounding box's floor.
   */
  baseAnchor: THREE.Vector3;
  /** Bounding-box size in meters, for camera framing. */
  size: THREE.Vector3;
  dispose: () => void;
};

/**
 * Wrap a model in a recentred pivot group and derive the stage anchors.
 *
 * `axis: "origin"` keeps the model's world-origin vertical axis (the pole /
 * product centreline) as the turntable axis, so the shaft stays fixed in
 * frame while overhangs (arm, head) orbit it. `"bbox"` centres on the
 * bounding box — needed for parts that live far from the origin (the head).
 */
function recentreForTurntable(
  content: THREE.Object3D,
  ledMaterial: THREE.MeshStandardMaterial,
  lampAnchor: THREE.Vector3,
  axis: "origin" | "bbox",
  onDispose?: () => void,
): TurntableAsset {
  const inner = new THREE.Group();
  inner.add(content);
  const box = new THREE.Box3().setFromObject(inner);
  const centre = box.getCenter(new THREE.Vector3());
  if (axis === "origin") {
    inner.position.set(0, -centre.y, 0);
  } else {
    inner.position.copy(centre).negate();
  }
  const group = new THREE.Group();
  group.add(inner);
  const size = box.getSize(new THREE.Vector3());

  return {
    group,
    ledMaterial,
    ledBaseIntensity: ledMaterial.emissiveIntensity,
    lampAnchor: lampAnchor.clone().add(inner.position),
    // The world-origin vertical axis at the bounding box's floor.
    baseAnchor: new THREE.Vector3(0, 0, 0).add(inner.position).setY(-size.y / 2),
    size,
    dispose: () => {
      disposeObject3D(group);
      onDispose?.();
    },
  };
}

/**
 * A product model re-staged for turntables: the ST89 luminaire head alone
 * ("head"), the complete street light ("full") — both cut from candeeiro.glb,
 * whose geometry bakes world position (~x1.6, y8.5) — or one of the procedural
 * showcase products ("bollard", "accessories"). Always recentred on the origin.
 */
export async function loadTurntable(variant: TurntableVariant = "head"): Promise<TurntableAsset> {
  if (variant === "bollard" || variant === "accessories") {
    const { buildShowcaseProduct } = await import("./showcaseProducts");
    const product = buildShowcaseProduct(variant);
    return recentreForTurntable(product.root, product.ledMaterial, product.lampAnchor, "origin");
  }

  const asset = await loadStreetLight();
  const ledPanel = asset.root.getObjectByName("ledpanel")!;

  const inner = new THREE.Group();
  if (variant === "head") {
    inner.add(asset.parts.head, ledPanel);
  } else {
    inner.add(asset.root);
  }
  return recentreForTurntable(
    inner,
    asset.ledMaterial,
    asset.lampAnchor,
    // The full lamp turns around its own pole axis; the head lives at world
    // x≈1.6 so it must centre on its bounding box instead.
    variant === "head" ? "bbox" : "origin",
    // In "head" mode the rest of the street light (pole, base…) never joined
    // a scene but still owns geometry and textures.
    variant === "head" ? () => disposeObject3D(asset.root) : undefined,
  );
}

export async function loadSkyline(maxAnisotropy = 4): Promise<SkylineAsset> {
  const gltf = await loader.loadAsync(SKYLINE_URL);
  const root = gltf.scene;
  root.updateMatrixWorld(true);

  const ledMaterials: EmissiveEntry[] = [];
  const windowMaterials: EmissiveEntry[] = [];
  const anisotropy = Math.min(8, maxAnisotropy);

  for (const material of collectMaterials(root)) {
    // The ground/road textures are viewed at grazing angles — sharpen them.
    if (material.map) {
      material.map.anisotropy = anisotropy;
      material.map.needsUpdate = true;
    }

    if (material.name === "Plástico Transparente") {
      patchLensMaterial(material);
    } else if (material.name === "Led Amarela") {
      ledMaterials.push({ material, base: material.emissiveIntensity });
    } else if (material.name === "Road") {
      // Exported with roughness 1 — bring back the wet-asphalt sheen.
      material.roughness = 0.4;
      material.envMapIntensity = 0.8;
    } else if (material.emissive.getHex() !== 0) {
      // Building windows and signage.
      windowMaterials.push({ material, base: material.emissiveIntensity });
    } else {
      // Terrain, pavement and building shells were authored under Blender's
      // scene lighting; under our studio IBL their bright albedo reads like
      // daylight. Pull the environment response down to night levels.
      material.envMapIntensity = 0.15;
      if (material.name === "Ground" || material.name === "Paviment") {
        material.color.multiplyScalar(0.5);
      }
    }
  }

  // A halo sprite anchor for every distant lamp head.
  const lampAnchors: THREE.Vector3[] = [];
  root.traverse((object) => {
    if (object.name === "ledpanel") lampAnchors.push(computeAnchor(object));
  });

  return { root, ledMaterials, windowMaterials, lampAnchors };
}

/** Dispose geometry, materials and every texture they reference. */
export function disposeObject3D(root: THREE.Object3D): void {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const entries = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of entries) {
      if (material) materials.add(material);
    }
  });
  for (const material of materials) {
    for (const value of Object.values(material)) {
      if ((value as THREE.Texture)?.isTexture) textures.add(value as THREE.Texture);
    }
    material.dispose();
  }
  for (const texture of textures) texture.dispose();
}

/** Soft radial gradient texture for glows, halos and light pools. */
export function makeGlowTexture(size = 256, inner = "rgba(218,237,255,1)", outer = "rgba(218,237,255,0)"): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.4, inner.replace(/,1\)$/, ",0.45)"));
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
