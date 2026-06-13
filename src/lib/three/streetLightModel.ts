import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/**
 * Procedural model of the Dufat hero street light: galvanized pole,
 * curved arm, ST89-style LED head, inspection door and anchored base.
 * Every annotatable component is exposed as a named part so the scroll
 * sequence can aim the camera and leader lines at it.
 */

export type StreetLightParts = {
  group: THREE.Group;
  head: THREE.Group;
  ledPanel: THREE.Mesh;
  photocell: THREE.Mesh;
  arm: THREE.Mesh;
  pole: THREE.Group;
  door: THREE.Group;
  base: THREE.Group;
};

// ---------- shared materials ----------

export const materials = {
  galvanized: new THREE.MeshStandardMaterial({
    color: 0xb7bdc4,
    metalness: 0.88,
    roughness: 0.38,
  }),
  headBody: new THREE.MeshStandardMaterial({
    color: 0x474d54,
    metalness: 0.65,
    roughness: 0.42,
  }),
  headTrim: new THREE.MeshStandardMaterial({
    color: 0x2d3238,
    metalness: 0.6,
    roughness: 0.5,
  }),
  concrete: new THREE.MeshStandardMaterial({
    color: 0x8e8d86,
    metalness: 0.02,
    roughness: 0.95,
  }),
  steelDark: new THREE.MeshStandardMaterial({
    color: 0x5d646c,
    metalness: 0.8,
    roughness: 0.45,
  }),
};

// ---------- texture helpers ----------

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

/** LED chip grid used as the emissive map of the luminaire panel. */
function makeLedGridTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#cfe6f7";
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = "#ffffff";
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 18; col += 1) {
      ctx.beginPath();
      ctx.arc(22 + col * 27, 20 + row * 30, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// ---------- model ----------

export function buildLuminaireHead(): { head: THREE.Group; ledPanel: THREE.Mesh; photocell: THREE.Mesh } {
  const head = new THREE.Group();

  // Main shell, slightly tapered toward the nose like the ST89.
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.96, 0.1, 0.3, 4, 0.04), materials.headBody);
  shell.position.set(0, 0.05, 0);
  head.add(shell);

  const nose = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.075, 0.24, 4, 0.035), materials.headTrim);
  nose.position.set(0.58, 0.045, 0);
  nose.scale.set(1, 0.85, 0.8);
  head.add(nose);

  // Raised spine on top (heat-sink hump).
  const spine = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.07, 0.2, 3, 0.03), materials.headTrim);
  spine.position.set(-0.05, 0.115, 0);
  head.add(spine);

  // Glowing LED panel on the underside.
  const ledTexture = makeLedGridTexture();
  const ledMaterial = new THREE.MeshStandardMaterial({
    color: 0x222222,
    emissive: 0xdaedff,
    emissiveMap: ledTexture,
    emissiveIntensity: 2.2,
    roughness: 0.3,
  });
  const ledPanel = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.015, 0.2), ledMaterial);
  ledPanel.position.set(-0.02, -0.004, 0);
  ledPanel.name = "ledPanel";
  head.add(ledPanel);

  // NEMA photocell socket on top — the "switches itself off at dawn" story beat.
  const photocell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.04, 0.045, 20),
    materials.headTrim,
  );
  photocell.position.set(-0.28, 0.17, 0);
  photocell.name = "photocell";
  head.add(photocell);

  return { head, ledPanel, photocell };
}

export function buildStreetLight(): StreetLightParts {
  const group = new THREE.Group();

  // ----- base: concrete plinth + flange plate + anchor bolts -----
  const base = new THREE.Group();
  base.name = "base";

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 0.85), materials.concrete);
  plinth.position.y = 0.21;
  base.add(plinth);

  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.025, 0.36), materials.steelDark);
  plate.position.y = 0.435;
  base.add(plate);

  // Four anchor bolts with hex nuts (6-segment cylinders read as hexes).
  for (const [dx, dz] of [
    [0.13, 0.13],
    [-0.13, 0.13],
    [0.13, -0.13],
    [-0.13, -0.13],
  ]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.09, 10), materials.galvanized);
    bolt.position.set(dx, 0.48, dz);
    base.add(bolt);
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.022, 6), materials.galvanized);
    nut.position.set(dx, 0.465, dz);
    base.add(nut);
  }

  // Gusset ribs between plate and pole.
  for (let i = 0; i < 4; i += 1) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.1, 0.1), materials.steelDark);
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    rib.position.set(Math.cos(angle) * 0.12, 0.5, Math.sin(angle) * 0.12);
    rib.rotation.y = -angle;
    base.add(rib);
  }
  group.add(base);

  // ----- pole: tapered galvanized shaft with collar joints -----
  const pole = new THREE.Group();
  pole.name = "pole";

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.105, 7.45, 24), materials.galvanized);
  shaft.position.y = 0.45 + 7.45 / 2;
  pole.add(shaft);

  for (const y of [2.9, 5.3]) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 24), materials.steelDark);
    collar.position.y = y;
    pole.add(collar);
  }
  group.add(pole);

  // ----- inspection door (driver/electrical compartment) -----
  const door = new THREE.Group();
  door.name = "door";
  const doorPlate = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.4, 0.11, 3, 0.012), materials.steelDark);
  doorPlate.position.set(0.085, 1.2, 0);
  door.add(doorPlate);
  for (const dy of [0.16, -0.16]) {
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.014, 10), materials.galvanized);
    screw.rotation.z = Math.PI / 2;
    screw.position.set(0.102, 1.2 + dy, 0);
    door.add(screw);
  }
  group.add(door);

  // ----- curved arm from pole top to the head -----
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 7.35, 0),
    new THREE.Vector3(0.02, 7.78, 0),
    new THREE.Vector3(0.3, 8.02, 0),
    new THREE.Vector3(0.78, 8.1, 0),
  ]);
  const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 32, 0.042, 14), materials.galvanized);
  arm.name = "arm";
  group.add(arm);

  // Clamp where the arm meets the pole.
  const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.22, 18), materials.steelDark);
  clamp.position.set(0, 7.32, 0);
  group.add(clamp);

  // ----- LED head at the end of the arm -----
  const { head, ledPanel, photocell } = buildLuminaireHead();
  head.name = "head";
  head.position.set(1.08, 8.12, 0);
  head.rotation.z = -0.06;
  group.add(head);

  return { group, head, ledPanel, photocell, arm, pole, door, base };
}
