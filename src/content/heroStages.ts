import type { PartName } from "@/lib/three/HeroScene";

export type HeroStage = {
  id: string;
  part: PartName;
  side: "left" | "right";
  /** Normalized scroll window [in, out] within the pinned sequence. */
  window: [number, number];
  kicker: string;
  title: string;
  bullets: string[];
};

/**
 * Story beats of the street light teardown. Windows are aligned with the
 * camera stops defined in HeroScene (0.16 / 0.32 / 0.48 / 0.64 / 0.80).
 */
export const HERO_STAGES: HeroStage[] = [
  {
    id: "head",
    part: "head",
    side: "left",
    window: [0.14, 0.3],
    kicker: "01 — Cabeça LED",
    title: "Luminária ST89",
    bullets: [
      "100 W · 150 W · 200 W",
      "Até 22 000 lúmen",
      "6500K CoolDaylight · IRC ≥ 70",
      "IP66 · vida útil de 20 000 h",
    ],
  },
  {
    id: "arm",
    part: "arm",
    side: "right",
    window: [0.3, 0.46],
    kicker: "02 — Braço",
    title: "Braço galvanizado",
    bullets: [
      "Inclinação de 15°",
      "Simples ou duplo · 1,00–1,50 m",
      "Aço galvanizado a quente",
      "Encaixe Ø60 mm com abraçadeiras",
    ],
  },
  {
    id: "pole",
    part: "pole",
    side: "left",
    window: [0.46, 0.62],
    kicker: "03 — Poste",
    title: "Coluna octogonal ou cilíndrica",
    bullets: [
      "Alturas de 2 a 12 metros",
      "Galvanização a quente por imersão",
      "Resiste à corrosão e ao clima costeiro",
      "Portinhola de inspeção integrada",
    ],
  },
  {
    id: "base",
    part: "base",
    side: "right",
    window: [0.62, 0.78],
    kicker: "04 — Fundação",
    title: "Base e chumbadores",
    bullets: [
      "Flange reforçada com nervuras",
      "Jogo de 4 chumbadores 16–20 mm",
      "Fundação em betão armado",
      "Nivelamento por dupla porca",
    ],
  },
  {
    id: "door",
    part: "door",
    side: "left",
    window: [0.78, 0.9],
    kicker: "05 — Driver",
    title: "Compartimento elétrico",
    bullets: [
      "Fator de potência > 0,9",
      "220–240 V · 50/60 Hz",
      "Proteção contra surtos",
      "Fotocélula: liga ao anoitecer, desliga ao amanhecer",
    ],
  },
];

/** Window for the closing call-to-action panel (the lamp hands over to dawn). */
export const FINAL_WINDOW: [number, number] = [0.92, 1];
