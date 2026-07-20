import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/**
 * Procedural product models for the catalog categories that have no
 * designer-delivered GLB (yet): a decorative LED bollard ("balizador") and an
 * electrical-accessories kit (junction box + NEMA photocell + anchor bolt on a
 * dark display puck). Built from primitives with PBR materials so they sit on
 * the same night turntable stage as candeeiro.glb.
 *
 * Every model stands on y=0 with the world origin on its vertical axis —
 * loadTurntable() recentres it for the pivot exactly like the GLB variants.
 */

export type ShowcaseProduct = {
  root: THREE.Group;
  /** The emissive material the stage's photocell/LED cycle animates. */
  ledMaterial: THREE.MeshStandardMaterial;
  /** Centre of the light-emitting part, in root space (halo + fill light). */
  lampAnchor: THREE.Vector3;
};

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/** Balizador decorativo — anthracite architectural bollard, warm 360° diffuser. */
export function buildBollard(): ShowcaseProduct {
  const root = new THREE.Group();

  const anthracite = new THREE.MeshStandardMaterial({
    color: 0x23272d,
    metalness: 0.82,
    roughness: 0.4,
  });
  const body = new THREE.MeshStandardMaterial({
    color: 0x2c3138,
    metalness: 0.78,
    roughness: 0.52,
  });
  const diffuser = new THREE.MeshStandardMaterial({
    color: 0xfff2dc,
    // Kept warm and moderate — higher intensities tone-map to clinical white.
    emissive: new THREE.Color(0xffb866),
    emissiveIntensity: 2.4,
    metalness: 0,
    roughness: 0.6,
  });

  // Base flange → shaft → trim ring → glowing diffuser → cap + dome.
  mesh(root, new THREE.CylinderGeometry(0.105, 0.115, 0.028, 40), anthracite, 0, 0.014, 0);
  mesh(root, new THREE.CylinderGeometry(0.072, 0.072, 0.61, 36), body, 0, 0.333, 0);
  mesh(root, new THREE.CylinderGeometry(0.077, 0.077, 0.022, 36), anthracite, 0, 0.649, 0);
  mesh(root, new THREE.CylinderGeometry(0.066, 0.066, 0.155, 36), diffuser, 0, 0.7375, 0);

  // Four vertical fins bridge the cap to the shaft across the diffuser — they
  // give the turntable rotation something to reveal.
  const finGeometry = new THREE.BoxGeometry(0.014, 0.185, 0.026);
  for (let i = 0; i < 4; i += 1) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const fin = mesh(
      root,
      finGeometry,
      anthracite,
      Math.cos(angle) * 0.069,
      0.7375,
      Math.sin(angle) * 0.069,
    );
    fin.rotation.y = -angle;
  }

  mesh(root, new THREE.CylinderGeometry(0.078, 0.073, 0.048, 36), anthracite, 0, 0.8395, 0);
  const dome = mesh(root, new THREE.SphereGeometry(0.075, 32, 16), anthracite, 0, 0.8635, 0);
  dome.scale.set(1, 0.38, 1);

  return { root, ledMaterial: diffuser, lampAnchor: new THREE.Vector3(0, 0.7375, 0) };
}

/**
 * Kit de acessórios elétricos — caixa de derivação, célula fotoelétrica e
 * chumbador, arranged on a dark showroom puck.
 */
export function buildAccessoriesKit(): ShowcaseProduct {
  const root = new THREE.Group();

  const puckMaterial = new THREE.MeshStandardMaterial({
    // Matte-dark so the warm lamp light doesn't turn it coppery.
    color: 0x141920,
    metalness: 0.35,
    roughness: 0.5,
  });
  const grey = new THREE.MeshStandardMaterial({
    color: 0xc9d0da,
    metalness: 0.05,
    roughness: 0.42,
  });
  const darkTrim = new THREE.MeshStandardMaterial({
    color: 0x3a4046,
    metalness: 0.8,
    roughness: 0.4,
  });
  const glandMetal = new THREE.MeshStandardMaterial({
    color: 0x565e66,
    metalness: 0.7,
    roughness: 0.45,
  });
  const zinc = new THREE.MeshStandardMaterial({
    color: 0xa4adb6,
    metalness: 0.88,
    roughness: 0.3,
  });
  const amberDome = new THREE.MeshStandardMaterial({
    color: 0xd08c3c,
    emissive: new THREE.Color(0xff9d3d),
    emissiveIntensity: 0.9,
    metalness: 0,
    roughness: 0.28,
    transparent: true,
    opacity: 0.92,
  });

  mesh(root, new THREE.CylinderGeometry(0.3, 0.31, 0.024, 48), puckMaterial, 0, 0.012, 0);
  const surface = 0.024;

  // --- Caixa de derivação: body, proud lid, corner screws, side cable glands.
  const box = new THREE.Group();
  box.position.set(-0.03, surface, -0.05);
  box.rotation.y = 0.12;
  root.add(box);
  mesh(box, new RoundedBoxGeometry(0.3, 0.21, 0.115, 4, 0.016), grey, 0, 0.105, 0);
  mesh(box, new RoundedBoxGeometry(0.262, 0.172, 0.024, 4, 0.01), grey, 0, 0.105, 0.0635);
  const screwGeometry = new THREE.CylinderGeometry(0.0068, 0.0068, 0.01, 12);
  for (const sx of [-0.104, 0.104]) {
    for (const sy of [-0.0615, 0.0615]) {
      const screw = mesh(box, screwGeometry, darkTrim, sx, 0.105 + sy, 0.0785);
      screw.rotation.x = Math.PI / 2;
    }
  }
  const glandGeometry = new THREE.CylinderGeometry(0.016, 0.016, 0.052, 16);
  const nutGeometry = new THREE.CylinderGeometry(0.0235, 0.0235, 0.016, 6);
  for (const gy of [0.062, 0.148]) {
    mesh(box, glandGeometry, glandMetal, -0.17, gy, 0).rotation.z = Math.PI / 2;
    mesh(box, nutGeometry, glandMetal, -0.158, gy, 0).rotation.z = Math.PI / 2;
  }

  // --- Célula fotoelétrica: dark base, amber dome (the kit's point of light).
  const cell = new THREE.Group();
  cell.position.set(0.16, surface, 0.12);
  root.add(cell);
  mesh(cell, new THREE.CylinderGeometry(0.047, 0.05, 0.03, 24), darkTrim, 0, 0.015, 0);
  mesh(cell, new THREE.CylinderGeometry(0.044, 0.044, 0.012, 24), darkTrim, 0, 0.036, 0);
  const cellDome = mesh(
    cell,
    new THREE.SphereGeometry(0.042, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    amberDome,
    0,
    0.042,
    0,
  );
  cellDome.scale.set(1, 0.92, 1);

  // --- Chumbador (J-bolt) lying on the puck: rod + hook + nuts + washer.
  // Built along +Y, laid flat with the hook end pointing at the puck centre.
  const boltWrapper = new THREE.Group();
  boltWrapper.position.set(-0.1, surface + 0.0115, 0.1);
  boltWrapper.rotation.y = 2.49;
  root.add(boltWrapper);
  const bolt = new THREE.Group();
  bolt.rotation.x = Math.PI / 2;
  boltWrapper.add(bolt);
  mesh(bolt, new THREE.CylinderGeometry(0.0115, 0.0115, 0.26, 14), zinc, 0, 0, 0);
  mesh(bolt, new THREE.TorusGeometry(0.03, 0.0115, 12, 20, Math.PI), zinc, 0.03, 0.13, 0);
  const boltNutGeometry = new THREE.CylinderGeometry(0.021, 0.021, 0.015, 6);
  mesh(bolt, boltNutGeometry, zinc, 0, -0.085, 0);
  mesh(bolt, boltNutGeometry, zinc, 0, -0.108, 0);
  mesh(bolt, new THREE.CylinderGeometry(0.028, 0.028, 0.0045, 24), zinc, 0, -0.1185, 0);

  return {
    root,
    ledMaterial: amberDome,
    lampAnchor: new THREE.Vector3(0.16, surface + 0.062, 0.12),
  };
}

export function buildShowcaseProduct(variant: "bollard" | "accessories"): ShowcaseProduct {
  return variant === "bollard" ? buildBollard() : buildAccessoriesKit();
}
