import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  disposeObject3D,
  loadSkyline,
  loadStreetLight,
  makeGlowTexture,
  type PartName,
  type SkylineAsset,
  type StreetLightAsset,
} from "./streetLightAssets";
import type { QualityTier } from "./quality";

export type HeroSceneOptions = {
  /** Fidelity: antialiasing, pixel ratio, star/particle counts. */
  quality: QualityTier;
  /** Whether the city GLB is part of this scene — independent of fidelity. */
  skyline: boolean;
  reducedMotion: boolean;
};

export type { PartName };

type CameraKey = { pos: [number, number, number]; target: [number, number, number] };

/**
 * Camera waypoints — one per story beat. STOPS maps them onto scroll progress.
 * Framed against candeeiro.glb's world-baked geometry: pole base ~y0.42,
 * pole top ~y8.08, luminaire head centred at ~(1.63, 8.53).
 */
const CAMERA_KEYS: CameraKey[] = [
  { pos: [6.3, 2.8, 9.2],    target: [0.6, 5.1, 0] },   // wide establishing shot
  { pos: [3.15, 8.05, 2.35], target: [1.63, 8.53, 0] }, // LED head, from just below
  { pos: [2.55, 8.35, 2.8],  target: [1.63, 8.53, 0] }, // …dwell on the head (slow orbit)
  { pos: [0.2, 8.2, 3.0],    target: [0.55, 8.25, 0] }, // arm / bracket
  { pos: [2.5, 4.3, 3.4],    target: [0.0, 4.6, 0] },   // pole shaft
  { pos: [1.9, 1.05, 2.8],   target: [0.0, 0.5, 0] },   // base & foundation
  { pos: [1.6, 1.95, 1.9],   target: [0.09, 1.5, 0] },  // driver door
  { pos: [-6.5, 3.2, 10.5],  target: [0.5, 5.0, 0] },   // dawn pull-back
];
// The head gets two stops (0.16 → 0.27) so the camera holds it centered for
// the whole annotation window instead of just passing through.
const STOPS = [0, 0.16, 0.27, 0.32, 0.48, 0.64, 0.8, 1];

type SkyKey = {
  t: number;
  top: number;
  mid: number;
  horizon: number;
  horizonGlow: number;
  env: number;
  lamp: number;
  stars: number;
  windows: number;
  moonOpacity: number;
  fogColor: number;
};

/** Dusk → night → deep night → pre-dawn → dawn (photocell switches the lamp off). */
const SKY_KEYS: SkyKey[] = [
  { t: 0.0,  top: 0x0d2238, mid: 0x1a3e60, horizon: 0x7fa8d4, horizonGlow: 0xf0a060, env: 0.5,  lamp: 0.55, stars: 0,    windows: 0.6,  moonOpacity: 0,    fogColor: 0x1a3050 },
  { t: 0.3,  top: 0x061226, mid: 0x0e2a4a, horizon: 0x2c4a6e, horizonGlow: 0x203858, env: 0.3,  lamp: 1,    stars: 0.55, windows: 1,    moonOpacity: 0.7,  fogColor: 0x0a1828 },
  { t: 0.72, top: 0x02060d, mid: 0x060f1c, horizon: 0x0d1b2e, horizonGlow: 0x0d1b2e, env: 0.16, lamp: 1,    stars: 1,    windows: 1,    moonOpacity: 0.85, fogColor: 0x060d18 },
  { t: 0.9,  top: 0x0b1830, mid: 0x162a48, horizon: 0x41557a, horizonGlow: 0x2a3c5a, env: 0.3,  lamp: 1,    stars: 0.35, windows: 0.7,  moonOpacity: 0.4,  fogColor: 0x0f1e30 },
  { t: 1.0,  top: 0x22395c, mid: 0x4a6080, horizon: 0xe9a473, horizonGlow: 0xf4703a, env: 0.75, lamp: 0,    stars: 0,    windows: 0.2,  moonOpacity: 0,    fogColor: 0x3a5570 },
];

// Measured from candeeiro.glb: centre of the "ledpanel" mesh in world space.
// Refined at runtime from the loaded asset (repositionLampRig), so a designer
// re-export that nudges the head only requires these framing defaults to stay
// roughly right.
const LAMP_X = 1.8;
const LAMP_Y = 8.53;

// skyline_far.glb lays its road surface at this height; ground-level dressing
// (light pool, contact shadow) lifts onto it when the environment loads.
const ROAD_Y = 0.13;

// Everything in the GLB terrain above this height is clipped away. The mesh is
// flat verge up to ~y1 and then climbs steeply to y33, so anything in 1.5–3
// keeps the grass and loses the hills; 2.5 leaves a little undulation.
const TERRAIN_CLIP_Y = 2.5;

// Forward (+X) bias of the light cast — kept small so the pool reads as
// directly beneath the luminaire head.
const LAMP_FORWARD = 0.15;

// Fog: dense and moody while the world is just the lamp; opened up when the
// city environment loads so buildings hundreds of meters away read through it.
// Note FogExp2 falls off as exp(−(density·depth)²) — squared — so the city
// value must be tiny: at 0.0013 a tower 500 m out keeps ~65% of its color and
// the farthest row (~850 m) still silhouettes softly instead of vanishing.
const FOG_DENSITY_NEAR = 0.018;
const FOG_DENSITY_CITY = 0.0013;

// Warm ambient spill from the city (attachSkyline), faded in with the rest.
const CITY_GLOW_INTENSITY = 0.14;

// The city fades in over this many seconds when its GLB lands: the fog thins
// from NEAR to CITY (towers emerge from it) while the near-field ground
// surfaces cross-fade in. Long enough to read as weather, short enough that a
// fast connection barely notices.
const SKYLINE_FADE_SECONDS = 2.2;

/** Static fallbacks for annotation anchors until the GLB reports real bounds. */
const DEFAULT_PART_ANCHORS: Record<PartName, THREE.Vector3> = {
  head: new THREE.Vector3(1.63, 8.53, 0),
  arm: new THREE.Vector3(0.52, 8.22, 0),
  pole: new THREE.Vector3(0.0, 4.25, 0),
  base: new THREE.Vector3(0.0, 0.3, 0),
  door: new THREE.Vector3(0.09, 1.52, 0),
};

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export class HeroScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private timer = new THREE.Timer();
  private frame = 0;
  private running = false;
  private progress = 0;
  private resizeObserver: ResizeObserver;
  private disposables: Array<{ dispose: () => void }> = [];
  private disposed = false;

  private streetLight?: StreetLightAsset;
  private skyline?: SkylineAsset;
  private partAnchors: Record<PartName, THREE.Vector3> = { ...DEFAULT_PART_ANCHORS };
  private readonly readyPromise: Promise<void>;

  private posCurve: THREE.CatmullRomCurve3;
  private targetCurve: THREE.CatmullRomCurve3;
  private cameraTarget = new THREE.Vector3();

  private skyMaterial: THREE.ShaderMaterial;
  private stars: THREE.Points;
  private lamp: THREE.SpotLight;
  private lampGlow: THREE.PointLight;
  private halo: THREE.Sprite;
  private haloCorona: THREE.Sprite;
  private beam: THREE.Mesh;
  private beamInner: THREE.Mesh;
  private lightPool: THREE.Mesh;
  private lightPoolSheen: THREE.Mesh;
  private contactShadow: THREE.Mesh;
  private particles?: THREE.Points;
  private particleSpeeds?: Float32Array;
  private moonLight: THREE.DirectionalLight;
  private moonSprite: THREE.Sprite;
  private groundMesh: THREE.Mesh;
  private laneDashes: THREE.Group;
  private glowTexture: THREE.Texture;
  /** Halo sprites on distant lamp heads — faded out with the photocell. */
  private distantHalos: Array<{ material: THREE.SpriteMaterial; base: number }> = [];
  private cityGlow?: THREE.PointLight;
  /** 0→1 while the late-arriving city fades in; scales its halos and glow. */
  private skylineReveal = 1;
  private skylineFade?: {
    start: number;
    groundMaterials: Array<{ material: THREE.MeshStandardMaterial; opacity: number }>;
  };

  private lampLevel = 1;
  private readonly options: HeroSceneOptions;

  constructor(canvas: HTMLCanvasElement, options: HeroSceneOptions) {
    this.options = options;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: options.quality === "high",
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, options.quality === "high" ? 1.75 : 1.25));
    // Lets attachSkyline clip the GLB terrain's hills off at TERRAIN_CLIP_Y.
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    // Far plane covers the skyline GLB's most distant towers (~860 m out).
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);

    // Subtle studio environment so the galvanized metal picks up reflections.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTexture;
    this.scene.environmentIntensity = 0.4;
    this.disposables.push(pmrem, envTexture);

    // ----- camera path -----
    this.posCurve = new THREE.CatmullRomCurve3(
      CAMERA_KEYS.map((key) => new THREE.Vector3(...key.pos)),
      false,
      "centripetal",
    );
    this.targetCurve = new THREE.CatmullRomCurve3(
      CAMERA_KEYS.map((key) => new THREE.Vector3(...key.target)),
      false,
      "centripetal",
    );

    // ----- sky dome -----
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor:      { value: new THREE.Color(SKY_KEYS[0].top) },
        midColor:      { value: new THREE.Color(SKY_KEYS[0].mid) },
        horizonColor:  { value: new THREE.Color(SKY_KEYS[0].horizon) },
        horizonGlow:   { value: new THREE.Color(SKY_KEYS[0].horizonGlow) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vWorldPosition;
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 horizonGlow;
        void main() {
          float h = normalize(vWorldPosition).y;
          // Upper sky blends top → mid
          float upperBlend = smoothstep(0.0, 0.55, h);
          vec3 upperSky = mix(midColor, topColor, pow(upperBlend, 0.7));
          // Near-horizon band blends horizon → mid
          float lowerBlend = smoothstep(0.0, 0.22, h);
          vec3 lowerSky = mix(horizonColor, upperSky, lowerBlend);
          // Warm glow right at the horizon line
          float glowBand = exp(-abs(h) * 14.0) * 0.9;
          vec3 sky = mix(lowerSky, horizonGlow, glowBand * (1.0 - upperBlend * 0.7));
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    // Large enough to sit behind the skyline GLB's towers.
    const dome = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), this.skyMaterial);
    this.scene.add(dome);
    this.scene.fog = new THREE.FogExp2(SKY_KEYS[0].fogColor, FOG_DENSITY_NEAR);

    // ----- stars -----
    this.stars = this.buildStars(options.quality === "high" ? 700 : 280);
    this.scene.add(this.stars);

    // ----- moon -----
    const moonTex = this.buildMoonTexture();
    this.disposables.push(moonTex);
    this.moonSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: moonTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        sizeAttenuation: false,
        fog: false,
      }),
    );
    // Place moon in the sky dome direction (upper-left)
    const moonDir = new THREE.Vector3(-0.55, 0.72, -0.42).normalize().multiplyScalar(900);
    this.moonSprite.position.copy(moonDir);
    this.moonSprite.scale.setScalar(0.055);
    this.scene.add(this.moonSprite);

    // ----- ground (wet asphalt) -----
    // Sized to sit under the whole city, not just the hero lamp: the skyline
    // GLB's own terrain is a hilly landscape and gets hidden (see
    // attachSkyline), so this plane is the ground in every quality tier. Two
    // triangles, so the extra extent is free.
    this.groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1800, 1800),
      new THREE.MeshStandardMaterial({
        color: 0x0e1218,   // dark asphalt, slightly lighter so it reads against the sky
        metalness: 0.75,
        roughness: 0.25,
        envMapIntensity: 1.6,
        // The skyline GLB (v4) flattened its grass "Ground" to a quad at
        // y≈−0.003 — effectively coplanar with this backdrop. Push the
        // backdrop away in the depth buffer so the GLB terrain wins the depth
        // test at every distance instead of z-fighting (grass shimmering in
        // and out as the camera moves on scroll).
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 2,
      }),
    );
    this.groundMesh.rotation.x = -Math.PI / 2;
    // Also sink it geometrically below the GLB grass plane: polygonOffset
    // units only cover ~1–2 depth ULPs, which at near range (< ~70 m) is less
    // than the 3 mm the grass sits below y=0. Both together keep the grass on
    // top from the verge to the horizon.
    this.groundMesh.position.y = -0.05;
    this.scene.add(this.groundMesh);

    // Lane markings centred on the road under the lamp.
    this.laneDashes = new THREE.Group();
    const dashMaterial = new THREE.MeshStandardMaterial({ color: 0xc8d2dc, roughness: 0.75 });
    for (let i = 0; i < 12; i += 1) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.005, 1.1), dashMaterial);
      dash.position.set(LAMP_X + 0.6, 0.003, 3 - i * 2.8);
      this.laneDashes.add(dash);
    }
    this.scene.add(this.laneDashes);

    // ----- lighting -----
    this.moonLight = new THREE.DirectionalLight(0x9fb6d8, 0.5);
    this.moonLight.position.set(-14, 22, 10);
    this.scene.add(this.moonLight);
    this.scene.add(new THREE.AmbientLight(0x223349, 0.8));

    // Spotlight origin at the LED panel underside, aimed almost straight down
    // (whisper of forward bias) so the pool of light sits visibly under the
    // luminaire. Kept tight and short-range so it pools instead of flooding
    // the skyline GLB's grass hillside.
    this.lamp = new THREE.SpotLight(0xfff8e8, 260, 20, Math.PI / 4.6, 0.7, 1.5);
    this.lamp.position.set(LAMP_X, LAMP_Y - 0.07, 0);
    this.lamp.target.position.set(LAMP_X + LAMP_FORWARD, 0, 0);
    this.scene.add(this.lamp, this.lamp.target);

    this.lampGlow = new THREE.PointLight(0xfff3cc, 16, 7, 1.8);
    this.lampGlow.position.set(LAMP_X, LAMP_Y - 0.1, 0);
    this.scene.add(this.lampGlow);

    // Halo sprite at the head — tight bright core.
    this.glowTexture = makeGlowTexture();
    this.disposables.push(this.glowTexture);
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.halo.position.set(LAMP_X, LAMP_Y - 0.07, 0);
    this.halo.scale.setScalar(1.7);
    this.scene.add(this.halo);

    // Wider, dimmer corona around the halo for the bloom falloff.
    const coronaTexture = makeGlowTexture(512, "rgba(255,240,180,0.55)", "rgba(255,240,180,0)");
    this.disposables.push(coronaTexture);
    this.haloCorona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: coronaTexture,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.haloCorona.position.set(LAMP_X, LAMP_Y - 0.07, 0);
    this.haloCorona.scale.setScalar(5.0);
    this.scene.add(this.haloCorona);

    // Fake volumetric beam — outer soft cone dropping from the lens. The cone
    // apex must coincide with the lens: with tilt θ the apex shifts back by
    // sin(θ)·H/2, so the cone centre sits at LAMP_FORWARD/2.
    const BEAM_H = LAMP_Y - 0.07;                        // floor to lamp
    const beamMidY = BEAM_H / 2;                         // vertical centre of the cone
    const beamTiltZ = -Math.atan2(LAMP_FORWARD, BEAM_H); // tilt toward the target offset
    this.beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.5, BEAM_H, 36, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffe8a0,
        transparent: true,
        opacity: 0.05,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.beam.position.set(LAMP_X + LAMP_FORWARD / 2, beamMidY, 0);
    this.beam.rotation.z = beamTiltZ;
    this.scene.add(this.beam);

    // Inner brighter cone for a hot-spot feel.
    this.beamInner = new THREE.Mesh(
      new THREE.ConeGeometry(1.0, BEAM_H * 0.95, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff5cc,
        transparent: true,
        opacity: 0.085,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.beamInner.position.set(LAMP_X + LAMP_FORWARD / 2, beamMidY, 0);
    this.beamInner.rotation.z = beamTiltZ;
    this.scene.add(this.beamInner);

    // Pool of light on the wet pavement — offset to where the beam hits the road.
    this.lightPool = new THREE.Mesh(
      new THREE.CircleGeometry(2.8, 48),
      new THREE.MeshBasicMaterial({
        map: makeGlowTexture(256, "rgba(255,235,160,0.9)", "rgba(255,235,160,0)"),
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.lightPool.rotation.x = -Math.PI / 2;
    this.lightPool.position.set(LAMP_X + LAMP_FORWARD, 0.01, 0);
    this.scene.add(this.lightPool);

    // Wider sheen on the wet ground simulating specular reflection of the lamp.
    const sheenTex = makeGlowTexture(256, "rgba(255,245,200,0.5)", "rgba(255,245,200,0)");
    this.disposables.push(sheenTex);
    this.lightPoolSheen = new THREE.Mesh(
      new THREE.CircleGeometry(5.5, 48),
      new THREE.MeshBasicMaterial({
        map: sheenTex,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.lightPoolSheen.rotation.x = -Math.PI / 2;
    this.lightPoolSheen.position.set(LAMP_X + LAMP_FORWARD * 0.7, 0.012, 0);
    this.scene.add(this.lightPoolSheen);

    // Soft contact shadow under the plinth.
    const shadowTexture = makeGlowTexture(128, "rgba(0,0,0,1)", "rgba(0,0,0,0)");
    this.disposables.push(shadowTexture);
    this.contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.15, 24),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = 0.005;
    this.scene.add(this.contactShadow);

    // ----- atmosphere particles in the beam -----
    if (!options.reducedMotion) {
      this.particles = this.buildParticles(options.quality === "high" ? 320 : 110, this.glowTexture);
      this.scene.add(this.particles);
    }

    // ----- designer-delivered GLB assets -----
    // The reveal waits only for the lamp. The city GLB is ~5x its size, so on
    // slow links gating the loader on it tripled the wait; instead it attaches
    // whenever it lands and fades in through the fog (see the tick() fade),
    // which keeps the lamp-against-empty-ground moment from reading as broken.
    // attachStreetLight catches its own load errors, so this never rejects.
    this.readyPromise = this.attachStreetLight();
    if (options.skyline) void this.attachSkyline();

    // ----- resize handling -----
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();

    this.setProgress(0);
    if (options.reducedMotion) {
      this.renderOnce();
    }
  }

  // ---------- GLB asset wiring ----------

  private async attachStreetLight(): Promise<void> {
    try {
      const asset = await loadStreetLight();
      if (this.disposed) {
        disposeObject3D(asset.root);
        return;
      }
      this.streetLight = asset;
      this.partAnchors = asset.partAnchors;
      this.scene.add(asset.root);
      this.repositionLampRig(asset.lampAnchor);
      // Without the skyline environment there are no lamps down the avenue —
      // clone the hero light into the distance (geometry is shared, so cheap).
      if (!this.options.skyline) {
        this.addDistantLampClones(asset);
      }
      this.applyLampLevel(this.lampLevel);
      if (this.options.reducedMotion) this.renderOnce();
    } catch (error) {
      // Degrade to the empty night scene rather than breaking the hero.
      console.error("HeroScene: failed to load candeeiro.glb", error);
    }
  }

  /**
   * Skyline GLB materials, found by the names the export uses. A re-delivery
   * that renames one costs us the terrain clip or the fade, not the scene.
   */
  private skylineMaterialsByName(
    root: THREE.Object3D,
    names: string[],
  ): THREE.MeshStandardMaterial[] {
    const found = new Set<THREE.MeshStandardMaterial>();
    root.traverse((object) => {
      const material = (object as THREE.Mesh).material;
      if (!material || Array.isArray(material)) return;
      if (names.includes(material.name)) found.add(material as THREE.MeshStandardMaterial);
    });
    return [...found];
  }

  private async attachSkyline(): Promise<void> {
    try {
      const asset = await loadSkyline(this.renderer.capabilities.getMaxAnisotropy());
      if (this.disposed) {
        disposeObject3D(asset.root);
        return;
      }
      this.skyline = asset;
      this.scene.add(asset.root);

      // The GLB brings its own textured road — retire our lane markings and
      // lift the road-level dressing onto its surface.
      //
      // Its terrain needs cutting down, though. The "Ground" mesh is a single
      // landscape spanning y −11.2 … +33 — taller than the 8.5 m lamp head — so
      // from road level the hills fill the frame and hide the city (worst on
      // narrow viewports, which frame more of them). But 55% of its vertices sit
      // below y=1: that is real flat grass verge either side of the avenue,
      // worth keeping. So clip by height rather than hiding the mesh. Where a
      // hill is cut away the surface opens up, and our asphalt plane below is
      // what shows through, so no hole reaches the sky.
      const [material] = this.skylineMaterialsByName(asset.root, ["Ground"]);
      if (material) {
        material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), TERRAIN_CLIP_Y)];
      }
      this.lightPool.position.y = ROAD_Y + 0.015;
      this.lightPoolSheen.position.y = ROAD_Y + 0.017;
      this.contactShadow.position.y = ROAD_Y + 0.01;

      // Halo sprite on every distant lamp head — the glowing dots that sell
      // the avenue at night. Grows slightly with distance so far lamps stay
      // legible instead of shrinking to nothing.
      for (const anchor of asset.lampAnchors) {
        const distance = anchor.length();
        if (distance < 4) continue; // that's the hero lamp's own spot
        const material = new THREE.SpriteMaterial({
          map: this.glowTexture,
          transparent: true,
          opacity: Math.max(0.15, 0.5 - distance * 0.004),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(anchor);
        sprite.scale.setScalar(1.4 + distance * 0.015);
        this.scene.add(sprite);
        this.distantHalos.push({ material, base: material.opacity });
      }

      // Warm ambient spill from the city.
      this.cityGlow = new THREE.PointLight(0xff9055, CITY_GLOW_INTENSITY, 160, 1.2);
      this.cityGlow.position.set(-5, 20, -120);
      this.scene.add(this.cityGlow);

      // Re-apply the current story beat to the freshly arrived materials.
      this.updateSky();

      if (this.options.reducedMotion) {
        // Static frame: no animation loop to run the fade — cut to the final
        // look and re-render.
        this.laneDashes.visible = false;
        (this.scene.fog as THREE.FogExp2).density = FOG_DENSITY_CITY;
        this.renderOnce();
        return;
      }
      this.beginSkylineFade(asset.root);
    } catch (error) {
      console.error("HeroScene: failed to load skyline_far.glb", error);
    }
  }

  /**
   * The city may land after the hero has already revealed (it no longer gates
   * the loader), so it can't just pop into frame. The dense pre-city fog
   * already hides everything beyond ~100 m, which lets the towers *emerge* as
   * tick() thins it to FOG_DENSITY_CITY. The near-field surfaces (grass verge,
   * road, paving) sit inside the fog's visible range though, so they get a
   * real opacity cross-fade over our placeholder asphalt.
   */
  private beginSkylineFade(root: THREE.Object3D): void {
    const groundMaterials = this.skylineMaterialsByName(root, ["Ground", "Road", "Paviment"]).map(
      (material) => {
        const entry = { material, opacity: material.opacity };
        material.transparent = true;
        material.opacity = 0;
        material.needsUpdate = true;
        return entry;
      },
    );
    this.skylineReveal = 0;
    this.skylineFade = { start: this.timer.getElapsed(), groundMaterials };
  }

  /** Anchor lights, halos, beams and pools to the loaded LED panel centre. */
  private repositionLampRig(anchor: THREE.Vector3): void {
    const { x, y } = anchor;
    this.lamp.position.set(x, y - 0.05, 0);
    this.lamp.target.position.set(x + LAMP_FORWARD, 0, 0);
    this.lampGlow.position.set(x, y - 0.1, 0);
    this.halo.position.set(x, y - 0.05, 0);
    this.haloCorona.position.set(x, y - 0.05, 0);
    const beamMidY = (y - 0.07) / 2;
    this.beam.position.set(x + LAMP_FORWARD / 2, beamMidY, 0);
    this.beamInner.position.set(x + LAMP_FORWARD / 2, beamMidY, 0);
    this.lightPool.position.x = x + LAMP_FORWARD;
    this.lightPoolSheen.position.x = x + LAMP_FORWARD * 0.7;
  }

  private addDistantLampClones(asset: StreetLightAsset): void {
    for (const [z, rotationY] of [[-18, 0.3], [-30, -0.2], [-44, 0.55]] as const) {
      const clone = asset.root.clone();
      clone.position.z = z;
      clone.rotation.y = rotationY;
      this.scene.add(clone);

      // Glow at the clone's lamp head, rotated with the clone.
      const headAnchor = asset.lampAnchor
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY)
        .add(clone.position);
      const distance = Math.abs(z);
      const material = new THREE.SpriteMaterial({
        map: this.glowTexture,
        transparent: true,
        opacity: Math.max(0.08, 0.45 - distance * 0.008),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(headAnchor);
      sprite.scale.setScalar(1.4);
      this.scene.add(sprite);
      this.distantHalos.push({ material, base: material.opacity });
    }
  }

  private buildStars(count: number): THREE.Points {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    // Star color palette: bluish-white, pure white, warm yellow-white
    const palette = [
      new THREE.Color(0xc8d8f8), // blue-white
      new THREE.Color(0xffffff), // pure white
      new THREE.Color(0xfff5cc), // warm yellow
      new THREE.Color(0xe8eeff), // cool white
    ];
    for (let i = 0; i < count; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.88); // bias away from horizon
      // Beyond the skyline towers so buildings occlude stars, not vice versa.
      const radius = 950;
      positions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      const c = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      vertexColors: true,
      size: 3.4,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
      fog: false,
    });
    return new THREE.Points(geometry, material);
  }

  private buildMoonTexture(): THREE.CanvasTexture {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    // Outer soft glow
    const glow = ctx.createRadialGradient(size/2, size/2, size*0.28, size/2, size/2, size/2);
    glow.addColorStop(0, "rgba(220,230,255,0)");
    glow.addColorStop(0.5, "rgba(200,215,255,0.04)");
    glow.addColorStop(1, "rgba(180,200,255,0.0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    // Moon disc
    const disc = ctx.createRadialGradient(size*0.46, size*0.46, 0, size/2, size/2, size*0.28);
    disc.addColorStop(0, "rgba(248,252,255,1)");
    disc.addColorStop(0.6, "rgba(220,232,255,0.95)");
    disc.addColorStop(1, "rgba(180,200,240,0)");
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size*0.3, 0, Math.PI*2);
    ctx.fill();
    // Subtle crater shadows
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#8090b0";
    for (const [cx, cy, r] of [[0.45,0.42,0.06],[0.55,0.5,0.04],[0.5,0.38,0.035],[0.42,0.55,0.03]] as [number,number,number][]) {
      ctx.beginPath();
      ctx.arc(size*cx, size*cy, size*r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildParticles(count: number, texture: THREE.Texture): THREE.Points {
    const positions = new Float32Array(count * 3);
    this.particleSpeeds = new Float32Array(count);
    const top = LAMP_Y - 0.4;
    for (let i = 0; i < count; i += 1) {
      const y = Math.random() * top + 0.2;
      const spread = 0.25 + ((LAMP_Y - y) / LAMP_Y) * 1.9; // wider near the ground, like the beam
      positions[i * 3] = LAMP_X + LAMP_FORWARD / 2 + (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
      this.particleSpeeds[i] = 0.12 + Math.random() * 0.3;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      map: texture,
      color: 0xcfe2ff,
      size: 0.06,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geometry, material);
  }

  // ---------- public API ----------

  /**
   * Resolves once the street light GLB is in the scene (or failed to load).
   * The skyline doesn't gate this — it fades in whenever it lands.
   */
  whenReady(): Promise<void> {
    return this.readyPromise;
  }

  start(): void {
    if (this.running || this.options.reducedMotion) return;
    this.running = true;
    const loop = (timestamp: number) => {
      if (!this.running) return;
      this.timer.update(timestamp);
      this.frame = requestAnimationFrame(loop);
      this.tick();
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frame);
  }

  /** Drives the whole sequence; p is the scrubbed scroll progress in [0, 1]. */
  setProgress(p: number): void {
    this.progress = THREE.MathUtils.clamp(p, 0, 1);
    this.updateCamera();
    this.updateSky();
    if (this.options.reducedMotion) this.renderOnce();
  }

  /** Projects a named part to viewport percentages for annotation leader lines. */
  projectPart(part: PartName): { x: number; y: number } {
    const projected = this.partAnchors[part].clone().project(this.camera);
    return { x: (projected.x * 0.5 + 0.5) * 100, y: (-projected.y * 0.5 + 0.5) * 100 };
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.resizeObserver.disconnect();
    disposeObject3D(this.scene);
    this.disposables.forEach((disposable) => disposable.dispose());
    this.renderer.dispose();
  }

  // ---------- internals ----------

  private resize(): void {
    const canvas = this.renderer.domElement;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? window.innerWidth;
    const height = parent?.clientHeight ?? window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.options.reducedMotion) this.renderOnce();
  }

  private updateCamera(): void {
    const p = this.progress;
    let segment = STOPS.length - 2;
    for (let i = 0; i < STOPS.length - 1; i += 1) {
      if (p <= STOPS[i + 1]) {
        segment = i;
        break;
      }
    }
    const a = STOPS[segment];
    const b = STOPS[segment + 1];
    const local = easeInOutCubic((p - a) / (b - a));
    const u = (segment + local) / (STOPS.length - 1);

    this.posCurve.getPoint(u, this.camera.position);
    this.targetCurve.getPoint(u, this.cameraTarget);
  }

  private updateSky(): void {
    const p = this.progress;
    let index = SKY_KEYS.length - 2;
    for (let i = 0; i < SKY_KEYS.length - 1; i += 1) {
      if (p <= SKY_KEYS[i + 1].t) {
        index = i;
        break;
      }
    }
    const from = SKY_KEYS[index];
    const to = SKY_KEYS[index + 1];
    const mix = THREE.MathUtils.clamp((p - from.t) / (to.t - from.t), 0, 1);

    (this.skyMaterial.uniforms.topColor.value as THREE.Color).setHex(from.top).lerp(new THREE.Color(to.top), mix);
    (this.skyMaterial.uniforms.midColor.value as THREE.Color).setHex(from.mid).lerp(new THREE.Color(to.mid), mix);
    (this.skyMaterial.uniforms.horizonColor.value as THREE.Color).setHex(from.horizon).lerp(new THREE.Color(to.horizon), mix);
    (this.skyMaterial.uniforms.horizonGlow.value as THREE.Color).setHex(from.horizonGlow).lerp(new THREE.Color(to.horizonGlow), mix);

    const fogColor = new THREE.Color(from.fogColor).lerp(new THREE.Color(to.fogColor), mix);
    (this.scene.fog as THREE.FogExp2).color.copy(fogColor);

    this.scene.environmentIntensity = THREE.MathUtils.lerp(from.env, to.env, mix);
    this.lampLevel = THREE.MathUtils.lerp(from.lamp, to.lamp, mix);
    (this.stars.material as THREE.PointsMaterial).opacity = THREE.MathUtils.lerp(from.stars, to.stars, mix);
    (this.moonSprite.material as THREE.SpriteMaterial).opacity = THREE.MathUtils.lerp(from.moonOpacity, to.moonOpacity, mix);

    // Building windows dim as the city sleeps and fade out at dawn.
    const windowLevel = THREE.MathUtils.lerp(from.windows, to.windows, mix);
    if (this.skyline) {
      for (const { material, base } of this.skyline.windowMaterials) {
        material.emissiveIntensity = base * windowLevel;
      }
    }

    this.moonLight.intensity = 0.2 + this.scene.environmentIntensity * 0.65;
    this.applyLampLevel(this.lampLevel);
  }

  private applyLampLevel(level: number): void {
    this.lamp.intensity = 260 * level;
    this.lampGlow.intensity = 16 * level;
    (this.halo.material as THREE.SpriteMaterial).opacity = 0.9 * level;
    (this.haloCorona.material as THREE.SpriteMaterial).opacity = 0.45 * level;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.055 * level;
    (this.beamInner.material as THREE.MeshBasicMaterial).opacity = 0.09 * level;
    (this.lightPool.material as THREE.MeshBasicMaterial).opacity = 0.5 * level;
    (this.lightPoolSheen.material as THREE.MeshBasicMaterial).opacity = 0.28 * level;
    if (this.streetLight) {
      this.streetLight.ledMaterial.emissiveIntensity =
        this.streetLight.ledBaseIntensity * Math.max(level, 0.02);
    }
    if (this.skyline) {
      for (const { material, base } of this.skyline.ledMaterials) {
        material.emissiveIntensity = base * Math.max(level, 0.02);
      }
    }
    for (const { material, base } of this.distantHalos) {
      material.opacity = base * level * this.skylineReveal;
    }
    if (this.particles) {
      (this.particles.material as THREE.PointsMaterial).opacity = 0.5 * level;
    }
  }

  private tick(): void {
    const t = this.timer.getElapsed();

    // Late-arriving city: thin the fog out and cross-fade the near surfaces.
    if (this.skylineFade) {
      const k = easeInOutCubic(
        THREE.MathUtils.clamp((t - this.skylineFade.start) / SKYLINE_FADE_SECONDS, 0, 1),
      );
      this.skylineReveal = k;
      (this.scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp(
        FOG_DENSITY_NEAR,
        FOG_DENSITY_CITY,
        k,
      );
      for (const { material, opacity } of this.skylineFade.groundMaterials) {
        material.opacity = opacity * k;
      }
      if (this.cityGlow) this.cityGlow.intensity = CITY_GLOW_INTENSITY * k;
      if (k >= 1) {
        // Restore opaque rendering — a permanently transparent terrain would
        // pay blending and sort-order costs every frame from here on.
        for (const { material, opacity } of this.skylineFade.groundMaterials) {
          material.transparent = false;
          material.opacity = opacity;
          material.needsUpdate = true;
        }
        // The GLB road is opaque now and fully covers our lane markings.
        this.laneDashes.visible = false;
        this.skylineFade = undefined;
      }
    }

    // Idle drift layered on top of the scroll-driven camera position.
    const driftX = Math.sin(t * 0.23) * 0.06;
    const driftY = Math.sin(t * 0.31 + 1.7) * 0.04;
    this.camera.position.x += driftX;
    this.camera.position.y += driftY;
    this.camera.lookAt(this.cameraTarget);
    this.camera.position.x -= driftX;
    this.camera.position.y -= driftY;

    // Gentle pole sway.
    if (this.streetLight) {
      this.streetLight.root.rotation.z = Math.sin(t * 0.6) * 0.0015;
    }

    // Lamp flicker: soft shimmer with occasional micro-dip for LED realism.
    const flicker = 1 + Math.sin(t * 7.3) * 0.014 + Math.sin(t * 23.7) * 0.009
      + Math.sin(t * 51.1) * 0.004
      + (Math.sin(t * 1.3) < -0.993 ? -0.14 : 0);
    this.applyLampLevel(this.lampLevel * flicker);

    // Subtle ripple on ground reflections.
    const ripple = 1 + Math.sin(t * 0.9) * 0.04;
    (this.lightPoolSheen.material as THREE.MeshBasicMaterial).opacity = 0.28 * this.lampLevel * flicker * ripple;

    // Drifting haze particles inside the beam.
    if (this.particles && this.particleSpeeds) {
      const attribute = this.particles.geometry.getAttribute("position") as THREE.BufferAttribute;
      const positions = attribute.array as Float32Array;
      for (let i = 0; i < this.particleSpeeds.length; i += 1) {
        positions[i * 3 + 1] -= this.particleSpeeds[i] * 0.016;
        positions[i * 3] += Math.sin(t * 0.8 + i) * 0.0007;
        if (positions[i * 3 + 1] < 0.1) positions[i * 3 + 1] = LAMP_Y - 0.6;
      }
      attribute.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  private renderOnce(): void {
    this.camera.lookAt(this.cameraTarget);
    this.renderer.render(this.scene, this.camera);
  }
}
