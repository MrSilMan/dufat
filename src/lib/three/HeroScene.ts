import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildStreetLight, makeGlowTexture, materials, type StreetLightParts } from "./streetLightModel";
import type { QualityTier } from "./quality";

export type HeroSceneOptions = {
  quality: QualityTier;
  reducedMotion: boolean;
};

export type PartName = "head" | "arm" | "pole" | "base" | "door";

type CameraKey = { pos: [number, number, number]; target: [number, number, number] };

/** Camera waypoints — one per story beat. STOPS maps them onto scroll progress. */
const CAMERA_KEYS: CameraKey[] = [
  { pos: [6.5, 2.0, 10.5], target: [0.5, 4.3, 0] }, // wide establishing shot
  { pos: [3.0, 7.55, 2.9], target: [0.95, 8.0, 0] }, // LED head
  { pos: [-1.7, 7.5, 3.3], target: [0.4, 7.78, 0] }, // arm / bracket
  { pos: [2.5, 4.3, 3.4], target: [0.0, 4.6, 0] }, // pole shaft
  { pos: [1.9, 1.05, 2.8], target: [0.0, 0.5, 0] }, // base & foundation
  { pos: [1.6, 1.65, 1.9], target: [0.1, 1.2, 0] }, // driver door
  { pos: [-7.5, 3.2, 11.5], target: [0.3, 4.5, 0] }, // dawn pull-back
];
const STOPS = [0, 0.16, 0.32, 0.48, 0.64, 0.8, 1];

type SkyKey = {
  t: number;
  top: number;
  horizon: number;
  env: number;
  lamp: number;
  stars: number;
  windows: number;
};

/** Dusk → night → deep night → pre-dawn → dawn (photocell switches the lamp off). */
const SKY_KEYS: SkyKey[] = [
  { t: 0.0, top: 0x0d2238, horizon: 0x7fa8d4, env: 0.5, lamp: 0.55, stars: 0, windows: 0.6 },
  { t: 0.3, top: 0x061226, horizon: 0x2c4a6e, env: 0.3, lamp: 1, stars: 0.55, windows: 1 },
  { t: 0.72, top: 0x02060d, horizon: 0x0d1b2e, env: 0.16, lamp: 1, stars: 1, windows: 1 },
  { t: 0.9, top: 0x0b1830, horizon: 0x41557a, env: 0.3, lamp: 1, stars: 0.35, windows: 0.7 },
  { t: 1.0, top: 0x22395c, horizon: 0xe9a473, env: 0.75, lamp: 0, stars: 0, windows: 0.2 },
];

const PART_POSITIONS: Record<PartName, THREE.Vector3> = {
  head: new THREE.Vector3(1.05, 8.1, 0),
  arm: new THREE.Vector3(0.35, 7.95, 0),
  pole: new THREE.Vector3(0.0, 4.6, 0),
  base: new THREE.Vector3(0.0, 0.45, 0),
  door: new THREE.Vector3(0.1, 1.2, 0),
};

function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export class HeroScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private parts: StreetLightParts;
  private timer = new THREE.Timer();
  private frame = 0;
  private running = false;
  private progress = 0;
  private resizeObserver: ResizeObserver;
  private disposables: Array<{ dispose: () => void }> = [];

  private posCurve: THREE.CatmullRomCurve3;
  private targetCurve: THREE.CatmullRomCurve3;
  private cameraTarget = new THREE.Vector3();

  private skyMaterial: THREE.ShaderMaterial;
  private stars: THREE.Points;
  private lamp: THREE.SpotLight;
  private lampGlow: THREE.PointLight;
  private halo: THREE.Sprite;
  private beam: THREE.Mesh;
  private lightPool: THREE.Mesh;
  private particles?: THREE.Points;
  private particleSpeeds?: Float32Array;
  private windowsMaterial?: THREE.MeshStandardMaterial;
  private moonLight: THREE.DirectionalLight;

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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220);

    // Subtle studio environment so the galvanized metal picks up reflections.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTexture;
    this.scene.environmentIntensity = 0.4;
    this.disposables.push(pmrem, envTexture);

    // ----- street light -----
    this.parts = buildStreetLight();
    this.scene.add(this.parts.group);

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
        topColor: { value: new THREE.Color(SKY_KEYS[0].top) },
        horizonColor: { value: new THREE.Color(SKY_KEYS[0].horizon) },
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
        uniform vec3 horizonColor;
        void main() {
          float h = normalize(vWorldPosition).y;
          float f = pow(max(h, 0.0), 0.5);
          gl_FragColor = vec4(mix(horizonColor, topColor, f), 1.0);
        }
      `,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 18), this.skyMaterial);
    this.scene.add(dome);
    this.scene.fog = new THREE.Fog(0x0a1422, 30, 110);

    // ----- stars -----
    this.stars = this.buildStars(options.quality === "high" ? 450 : 200);
    this.scene.add(this.stars);

    // ----- ground (wet asphalt) -----
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(80, 48),
      new THREE.MeshStandardMaterial({ color: 0x070b11, metalness: 0.65, roughness: 0.3 }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // Lane markings receding down the road.
    const dashMaterial = new THREE.MeshStandardMaterial({ color: 0xb9c2cc, roughness: 0.8 });
    for (let i = 0; i < 9; i += 1) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.005, 1.1), dashMaterial);
      dash.position.set(3.4, 0.003, 2 - i * 2.6);
      this.scene.add(dash);
    }

    // ----- lighting -----
    this.moonLight = new THREE.DirectionalLight(0x9fb6d8, 0.5);
    this.moonLight.position.set(-14, 22, 10);
    this.scene.add(this.moonLight);
    this.scene.add(new THREE.AmbientLight(0x223349, 0.8));

    this.lamp = new THREE.SpotLight(0xdfefff, 320, 24, Math.PI / 3.4, 0.55, 1.6);
    this.lamp.position.set(1.05, 8.05, 0);
    this.lamp.target.position.set(1.3, 0, 0);
    this.scene.add(this.lamp, this.lamp.target);

    this.lampGlow = new THREE.PointLight(0xcfe6ff, 14, 7, 1.8);
    this.lampGlow.position.set(1.05, 7.85, 0);
    this.scene.add(this.lampGlow);

    // Halo sprite at the head.
    const glowTexture = makeGlowTexture();
    this.disposables.push(glowTexture);
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.halo.position.set(1.02, 8.02, 0);
    this.halo.scale.setScalar(2.6);
    this.scene.add(this.halo);

    // Fake volumetric beam cone.
    const beamTexture = makeGlowTexture(128);
    this.disposables.push(beamTexture);
    this.beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 7.8, 30, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xbfdcff,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.beam.position.set(1.1, 4.1, 0);
    this.scene.add(this.beam);

    // Pool of light on the wet pavement.
    this.lightPool = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 36),
      new THREE.MeshBasicMaterial({
        map: glowTexture,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.lightPool.rotation.x = -Math.PI / 2;
    this.lightPool.position.set(1.25, 0.01, 0);
    this.scene.add(this.lightPool);

    // Soft contact shadow under the plinth.
    const shadowTexture = makeGlowTexture(128, "rgba(0,0,0,1)", "rgba(0,0,0,0)");
    this.disposables.push(shadowTexture);
    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.1, 24),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.005;
    this.scene.add(contactShadow);

    // ----- atmosphere particles in the beam -----
    if (!options.reducedMotion) {
      this.particles = this.buildParticles(options.quality === "high" ? 320 : 110, glowTexture);
      this.scene.add(this.particles);
    }

    // ----- distant city + receding street lights -----
    if (options.quality === "high") {
      this.buildSkyline();
    }
    this.buildDistantLamps(glowTexture);

    // ----- resize handling -----
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement ?? canvas);
    this.resize();

    this.setProgress(0);
    if (options.reducedMotion) {
      this.renderOnce();
    }
  }

  private buildStars(count: number): THREE.Points {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      // Upper hemisphere, pushed out near the dome radius.
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.85); // bias away from horizon
      const radius = 82;
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xdce8f8,
      size: 0.35,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    return new THREE.Points(geometry, material);
  }

  private buildParticles(count: number, texture: THREE.Texture): THREE.Points {
    const positions = new Float32Array(count * 3);
    this.particleSpeeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const y = Math.random() * 7.6 + 0.2;
      const spread = 0.25 + ((8 - y) / 8) * 1.9; // wider near the ground, like the beam
      positions[i * 3] = 1.1 + (Math.random() - 0.5) * spread;
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

  private buildSkyline(): void {
    // Distant building silhouettes with lit windows.
    const windowCanvas = document.createElement("canvas");
    windowCanvas.width = 64;
    windowCanvas.height = 128;
    const ctx = windowCanvas.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = "#ffd9a0";
    for (let y = 6; y < 122; y += 12) {
      for (let x = 6; x < 58; x += 12) {
        if (Math.random() < 0.4) ctx.fillRect(x, y, 6, 7);
      }
    }
    const windowTexture = new THREE.CanvasTexture(windowCanvas);
    windowTexture.colorSpace = THREE.SRGBColorSpace;
    this.disposables.push(windowTexture);

    this.windowsMaterial = new THREE.MeshStandardMaterial({
      color: 0x05080e,
      emissive: 0xffffff,
      emissiveMap: windowTexture,
      emissiveIntensity: 0.55,
      roughness: 0.9,
    });

    for (let i = 0; i < 22; i += 1) {
      const width = 2.5 + Math.random() * 4;
      const height = 5 + Math.random() * 12;
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, 3), this.windowsMaterial);
      const x = -42 + i * 4 + Math.random() * 2;
      const z = -24 - Math.random() * 18;
      building.position.set(x, height / 2, z);
      this.scene.add(building);
    }
  }

  private buildDistantLamps(glowTexture: THREE.Texture): void {
    // A few simplified street lights receding down the avenue for depth.
    for (const z of [-9, -18, -28]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 7.6, 10), materials.galvanized);
      pole.position.set(0, 3.8, z);
      this.scene.add(pole);
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      glow.position.set(0.9, 7.9, z);
      glow.scale.setScalar(1.8);
      this.scene.add(glow);
    }
  }

  // ---------- public API ----------

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
    const projected = PART_POSITIONS[part].clone().project(this.camera);
    return { x: (projected.x * 0.5 + 0.5) * 100, y: (-projected.y * 0.5 + 0.5) * 100 };
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material?.dispose();
    });
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

    (this.skyMaterial.uniforms.topColor.value as THREE.Color)
      .setHex(from.top)
      .lerp(new THREE.Color(to.top), mix);
    (this.skyMaterial.uniforms.horizonColor.value as THREE.Color)
      .setHex(from.horizon)
      .lerp(new THREE.Color(to.horizon), mix);

    this.scene.environmentIntensity = THREE.MathUtils.lerp(from.env, to.env, mix);
    this.lampLevel = THREE.MathUtils.lerp(from.lamp, to.lamp, mix);
    (this.stars.material as THREE.PointsMaterial).opacity = THREE.MathUtils.lerp(from.stars, to.stars, mix);
    if (this.windowsMaterial) {
      this.windowsMaterial.emissiveIntensity = 0.55 * THREE.MathUtils.lerp(from.windows, to.windows, mix);
    }
    this.moonLight.intensity = 0.25 + this.scene.environmentIntensity * 0.7;
    this.applyLampLevel(this.lampLevel);
  }

  private applyLampLevel(level: number): void {
    this.lamp.intensity = 320 * level;
    this.lampGlow.intensity = 14 * level;
    (this.halo.material as THREE.SpriteMaterial).opacity = 0.85 * level;
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.07 * level;
    (this.lightPool.material as THREE.MeshBasicMaterial).opacity = 0.4 * level;
    (this.parts.ledPanel.material as THREE.MeshStandardMaterial).emissiveIntensity = 2.2 * level + 0.05;
    if (this.particles) {
      (this.particles.material as THREE.PointsMaterial).opacity = 0.45 * level;
    }
  }

  private tick(): void {
    const t = this.timer.getElapsed();

    // Idle drift layered on top of the scroll-driven camera position.
    const driftX = Math.sin(t * 0.23) * 0.06;
    const driftY = Math.sin(t * 0.31 + 1.7) * 0.04;
    this.camera.position.x += driftX;
    this.camera.position.y += driftY;
    this.camera.lookAt(this.cameraTarget);
    this.camera.position.x -= driftX;
    this.camera.position.y -= driftY;

    // Gentle pole sway.
    this.parts.group.rotation.z = Math.sin(t * 0.6) * 0.0015;

    // Lamp flicker: a soft shimmer with the occasional dip.
    const flicker = 1 + Math.sin(t * 7.3) * 0.012 + Math.sin(t * 23.7) * 0.008 + (Math.sin(t * 1.3) < -0.992 ? -0.12 : 0);
    this.applyLampLevel(this.lampLevel * flicker);

    // Drifting haze particles inside the beam.
    if (this.particles && this.particleSpeeds) {
      const attribute = this.particles.geometry.getAttribute("position") as THREE.BufferAttribute;
      const positions = attribute.array as Float32Array;
      for (let i = 0; i < this.particleSpeeds.length; i += 1) {
        positions[i * 3 + 1] -= this.particleSpeeds[i] * 0.016;
        positions[i * 3] += Math.sin(t * 0.8 + i) * 0.0007;
        if (positions[i * 3 + 1] < 0.1) positions[i * 3 + 1] = 7.8;
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
