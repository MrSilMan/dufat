"use client";

import { useEffect, useRef } from "react";
import { gsap, useGSAP, prefersReducedMotion } from "@/lib/gsap";

/**
 * Scroll-scrubbed 360° turntable of the ST89 luminaire head (Three.js),
 * with pointer-drag override. Lazy-loads the Three bundle on mount.
 */
export function ProductViewer360({ label }: { label: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ scroll: 0, drag: 0, dispose: () => {} });

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;
    const state = stateRef.current;

    void (async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");
      const { buildLuminaireHead } = await import("@/lib/three/streetLightModel");
      const canvas = canvasRef.current;
      if (cancelled || !canvas) return;

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.9;

      const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 20);
      camera.position.set(0, 0.45, 1.7);
      camera.lookAt(0.1, 0, 0);

      const { head } = buildLuminaireHead();
      head.position.x = -0.1;
      const pivot = new THREE.Group();
      pivot.add(head);
      pivot.rotation.x = 0.25;
      scene.add(pivot);

      scene.add(new THREE.AmbientLight(0x8aa6c8, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 1.6);
      key.position.set(2, 3, 2);
      scene.add(key);

      const resize = () => {
        const parent = canvas.parentElement!;
        renderer.setSize(parent.clientWidth, parent.clientHeight, false);
        camera.aspect = parent.clientWidth / parent.clientHeight;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(canvas.parentElement!);
      resize();

      let frame = 0;
      const loop = () => {
        frame = requestAnimationFrame(loop);
        pivot.rotation.y = state.scroll * Math.PI * 2 + state.drag;
        renderer.render(scene, camera);
      };
      loop();

      state.dispose = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        scene.traverse((object) => {
          const mesh = object as { geometry?: { dispose(): void }; material?: { dispose(): void } };
          mesh.geometry?.dispose();
          mesh.material?.dispose();
        });
        pmrem.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      cancelled = true;
      state.dispose();
    };
  }, []);

  useGSAP(
    () => {
      if (prefersReducedMotion() || !wrapRef.current) return;
      const state = stateRef.current;
      gsap.to(state, {
        scroll: 1,
        ease: "none",
        scrollTrigger: {
          trigger: wrapRef.current,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.5,
        },
      });
    },
    { scope: wrapRef },
  );

  // Pointer drag for manual inspection.
  const dragging = useRef<{ active: boolean; lastX: number }>({ active: false, lastX: 0 });
  const onPointerDown = (event: React.PointerEvent) => {
    dragging.current = { active: true, lastX: event.clientX };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging.current.active) return;
    stateRef.current.drag += (event.clientX - dragging.current.lastX) * 0.008;
    dragging.current.lastX = event.clientX;
  };
  const onPointerUp = () => {
    dragging.current.active = false;
  };

  return (
    <div ref={wrapRef} className="relative h-[60vh] min-h-96 w-full md:h-[70vh]">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Modelo 3D interativo: ${label}. Role a página ou arraste para rodar.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="h-full w-full cursor-grab touch-pan-y active:cursor-grabbing"
      />
      <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.25em] text-white/40">
        Role ou arraste para rodar
      </p>
    </div>
  );
}
