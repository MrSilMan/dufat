import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  loadTurntable,
  makeGlowTexture,
  type TurntableVariant,
} from "./streetLightAssets";

/**
 * Shared Three.js staging for product turntables (ProductViewer360,
 * LampShowcase): studio IBL + key light, a cool rim and warm kicker so dark
 * metal separates from dark backdrops, a two-layer LED glow (tight core +
 * soft corona), and a camera framed from the model's real bounding box.
 *
 * `dress: "night"` adds the catalog-card dressing — a fake volumetric beam
 * under the lens, a warm pool of light and a contact shadow at the base —
 * while the default "studio" keeps the clean product-viewer look.
 */
export type TurntableStage = {
  /**
   * Apply turntable rotation (radians) and draw a frame. `pitch` tilts the
   * pivot on top of the variant's base tilt (pointer-drag orbiting).
   */
  render: (rotation: number, pitch?: number) => void;
  /** 0 = LED off, 1 = authored full brightness. */
  setLed: (level: number) => void;
  dispose: () => void;
};

export type TurntableStageOptions = {
  /** Camera framing multiplier: >1 moves closer (product cards), 1 = default studio framing. */
  zoom?: number;
  /** Pivot pitch in radians; overrides the per-variant default. */
  tilt?: number;
  /** "studio" (default) = clean viewer; "night" adds beam/pool/shadow dressing. */
  dress?: "studio" | "night";
};

type VariantStaging = {
  /** Camera position as multiples of the framing distance. */
  camY: number;
  camZ: number;
  /** Camera target height × model radius: >0 composes the model lower, cropping at the base. */
  lookY?: number;
  /** Pivot pitch (radians). Negative pitches the underside — the lens — toward the camera. */
  tilt: number;
  /** Glow sprite scales, × model radius. */
  core: number;
  corona: number;
  coronaOpacity: number;
  /** Warm fill light at the lamp anchor, intensity at full LED brightness. */
  lampLightMax: number;
  /** Night dressing toggles. */
  beam?: boolean;
  pool?: boolean;
  /** Contact shadow radius × model radius (omit for floating shots). */
  shadowScale?: number;
};

const STAGING: Record<TurntableVariant, VariantStaging> = {
  // Luminaire alone: lens pitched toward the viewer, glowing, light spilling down.
  head: { camY: 0.1, camZ: 1.15, tilt: -0.48, core: 0.2, corona: 0.6, coronaOpacity: 0.32, lampLightMax: 4, beam: true },
  // Complete street light: level camera, beam + pool sell the night scene and
  // silhouette the pole; rim light keeps the shaft legible.
  full: { camY: 0.05, camZ: 1.2, tilt: 0.03, core: 0.12, corona: 0.24, coronaOpacity: 0.4, lampLightMax: 40, beam: true, pool: true, shadowScale: 0.1 },
  // Bollard: warm 360° diffuser, soft pool at the flange.
  bollard: { camY: 0.12, camZ: 1.18, tilt: 0.05, core: 0.22, corona: 0.6, coronaOpacity: 0.3, lampLightMax: 2.5, pool: true, shadowScale: 0.17 },
  // Accessories kit: viewed from above, only the photocell dome glows.
  accessories: { camY: 0.34, camZ: 1.12, tilt: 0.04, core: 0.12, corona: 0.34, coronaOpacity: 0.22, lampLightMax: 1.4, shadowScale: 0.55 },
};

export async function createTurntableStage(
  canvas: HTMLCanvasElement,
  variant: TurntableVariant,
  options: TurntableStageOptions = {},
): Promise<TurntableStage> {
  const asset = await loadTurntable(variant);
  const staging = STAGING[variant];
  const night = options.dress === "night";
  const disposables: Array<{ dispose: () => void }> = [];

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = night ? 0.75 : 0.9;
  disposables.push(pmrem, environment);

  const fov = 30;
  const zoom = options.zoom ?? 1;
  const radius = Math.max(asset.size.x, asset.size.y, asset.size.z);
  const halfFov = (fov * Math.PI) / 360;
  const baseTilt = options.tilt ?? staging.tilt;
  const camera = new THREE.PerspectiveCamera(fov, 1, radius * 0.01, 1);

  /**
   * Fit the model's height *and* width: a perspective camera holds vertical FOV
   * fixed, so on a narrow canvas (tall product cards) the horizontal FOV closes
   * in and crops the model's ends. Backing off by the aspect shortfall keeps the
   * whole model in frame at any canvas shape.
   */
  const frameDistance = (aspect: number) => {
    // Turntable rotation swings the deepest axis into view, and the pivot tilt
    // lifts the projected height above size.y — fit the worst case of both.
    const spun = Math.hypot(asset.size.x, asset.size.z);
    const tilted = Math.abs(asset.size.y * Math.cos(baseTilt)) + Math.abs(spun * Math.sin(baseTilt));
    const fitHeight = tilted / (2 * Math.tan(halfFov));
    const fitWidth = spun / (2 * Math.tan(halfFov) * Math.max(aspect, 0.01));
    return Math.max(fitHeight, fitWidth) / zoom;
  };

  let distance = frameDistance(1);
  const place = () => {
    camera.position.set(0, distance * staging.camY, distance * staging.camZ);
    camera.lookAt(0, radius * (staging.lookY ?? 0), 0);
    camera.far = distance * 6 + radius * 4;
    camera.updateProjectionMatrix();
  };

  const pivot = new THREE.Group();
  pivot.add(asset.group);
  pivot.rotation.x = baseTilt;
  scene.add(pivot);

  // Key from front-left; cool rim + warm kicker from behind draw the edge
  // highlights that keep galvanized metal visible against a dark card.
  scene.add(new THREE.AmbientLight(0x8aa6c8, night ? 0.5 : 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(2.2, 3, 2.4);
  const rim = new THREE.DirectionalLight(0xa8ccff, night ? 2.6 : 1.4);
  rim.position.set(-2.6, 1.8, -2.8);
  const kicker = new THREE.DirectionalLight(0xffd9a0, night ? 0.9 : 0.5);
  kicker.position.set(3, 0.7, -2.2);
  scene.add(key, rim, kicker);

  // Two-layer glow at the LED: tight bright core + wide soft corona.
  const coreTexture = makeGlowTexture(256, "rgba(255,216,150,1)", "rgba(255,216,150,0)");
  const coreMaterial = new THREE.SpriteMaterial({
    map: coreTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const core = new THREE.Sprite(coreMaterial);
  core.position.copy(asset.lampAnchor);
  core.scale.setScalar(radius * staging.core);
  asset.group.add(core);
  disposables.push(coreTexture, coreMaterial);

  const coronaTexture = makeGlowTexture(512, "rgba(255,238,176,1)", "rgba(255,238,176,0)");
  const coronaMaterial = new THREE.SpriteMaterial({
    map: coronaTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const corona = new THREE.Sprite(coronaMaterial);
  corona.position.copy(asset.lampAnchor);
  corona.scale.setScalar(radius * staging.corona);
  asset.group.add(corona);
  disposables.push(coronaTexture, coronaMaterial);

  // Warm fill so nearby metal (arm, pole, box) catches the LED light.
  const lampLight = new THREE.PointLight(0xffd9a0, 0, radius * 5, 1.8);
  lampLight.position.copy(asset.lampAnchor);
  asset.group.add(lampLight);

  // ----- night dressing: beam, pool of light, contact shadow -----
  const baseY = asset.baseAnchor.y;
  const beamMaterials: Array<{ material: THREE.MeshBasicMaterial; base: number }> = [];
  let poolMaterial: THREE.MeshBasicMaterial | undefined;

  if (night && staging.beam) {
    const beamLength =
      variant === "head"
        ? radius * 1.9 // floating head: the light falls out of frame
        : Math.max(asset.lampAnchor.y - baseY, radius * 0.5);
    const beams: Array<[number, number, number, number]> = [
      // [cone radius, length, color, opacity]
      [beamLength * 0.27, beamLength, 0xffe8a0, 0.045],
      [beamLength * 0.11, beamLength * 0.96, 0xfff5cc, 0.07],
    ];
    for (const [beamRadius, length, color, opacity] of beams) {
      const geometry = new THREE.ConeGeometry(beamRadius, length, 32, 1, true);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const cone = new THREE.Mesh(geometry, material);
      // Apex exactly at the lens.
      cone.position.set(asset.lampAnchor.x, asset.lampAnchor.y - length / 2, asset.lampAnchor.z);
      asset.group.add(cone);
      beamMaterials.push({ material, base: opacity });
      disposables.push(geometry, material);
    }
  }

  if (night && staging.pool) {
    const poolRadius = staging.beam
      ? (asset.lampAnchor.y - baseY) * 0.34
      : radius * 0.55;
    const poolTexture = makeGlowTexture(256, "rgba(255,235,160,1)", "rgba(255,235,160,0)");
    const geometry = new THREE.CircleGeometry(poolRadius, 48);
    poolMaterial = new THREE.MeshBasicMaterial({
      map: poolTexture,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pool = new THREE.Mesh(geometry, poolMaterial);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(asset.lampAnchor.x, baseY + radius * 0.004, asset.lampAnchor.z);
    pool.renderOrder = 2;
    asset.group.add(pool);
    disposables.push(poolTexture, geometry, poolMaterial);
  }

  if (night && staging.shadowScale) {
    const shadowTexture = makeGlowTexture(128, "rgba(0,0,0,1)", "rgba(0,0,0,0)");
    const geometry = new THREE.CircleGeometry(radius * staging.shadowScale, 32);
    const material = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(geometry, material);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(asset.baseAnchor.x, baseY + radius * 0.002, asset.baseAnchor.z);
    shadow.renderOrder = 1;
    asset.group.add(shadow);
    disposables.push(shadowTexture, geometry, material);
  }

  const setLed = (level: number) => {
    asset.ledMaterial.emissiveIntensity = asset.ledBaseIntensity * level;
    coreMaterial.opacity = 0.9 * level;
    coronaMaterial.opacity = staging.coronaOpacity * level;
    lampLight.intensity = staging.lampLightMax * level;
    for (const { material, base } of beamMaterials) {
      material.opacity = base * level;
    }
    if (poolMaterial) poolMaterial.opacity = 0.5 * level;
  };
  setLed(1);

  const resize = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    renderer.setSize(parent.clientWidth, parent.clientHeight, false);
    camera.aspect = parent.clientWidth / Math.max(parent.clientHeight, 1);
    // Framing depends on aspect, so the camera has to be re-placed on resize.
    distance = frameDistance(camera.aspect);
    place();
  };
  const observer = new ResizeObserver(resize);
  if (canvas.parentElement) observer.observe(canvas.parentElement);
  resize();

  return {
    render: (rotation: number, pitch = 0) => {
      pivot.rotation.y = rotation;
      pivot.rotation.x = baseTilt + pitch;
      renderer.render(scene, camera);
    },
    setLed,
    dispose: () => {
      observer.disconnect();
      asset.dispose();
      disposables.forEach((disposable) => disposable.dispose());
      renderer.dispose();
    },
  };
}
