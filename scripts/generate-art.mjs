/**
 * Generates branded SVG placeholder art for products and case studies.
 * Run once at scaffold time: node scripts/generate-art.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

// Product silhouettes drawn in a 800x600 viewBox, light-gray strokes/fills.
const silhouettes = {
  "luminaria-st89": `
    <g transform="translate(400 300) rotate(-18)">
      <rect x="-190" y="-46" width="380" height="92" rx="44" fill="#c7ced6"/>
      <rect x="-150" y="-26" width="260" height="52" rx="22" fill="#114F8C" opacity="0.85"/>
      <g fill="#eaf6ff">${Array.from({ length: 18 }, (_, i) => `<circle cx="${-138 + (i % 9) * 31}" cy="${i < 9 ? -13 : 13}" r="8"/>`).join("")}</g>
      <rect x="172" y="-20" width="80" height="40" rx="10" fill="#9aa3ad"/>
    </g>`,
  "poste-octogonal": `
    <g fill="#c7ced6">
      <polygon points="385,80 415,80 412,520 388,520"/>
      <rect x="350" y="520" width="100" height="18" rx="4"/>
      <rect x="330" y="538" width="140" height="32" rx="6" fill="#9aa3ad"/>
      <path d="M412 95 Q480 92 520 118" stroke="#c7ced6" stroke-width="16" fill="none" stroke-linecap="round"/>
      <rect x="505" y="100" width="92" height="30" rx="15"/>
    </g>
    <circle cx="551" cy="115" r="46" fill="#8FC3FF" opacity="0.35"/>`,
  "poste-cilindrico": `
    <g fill="#c7ced6">
      <rect x="388" y="80" width="24" height="440" rx="10"/>
      <rect x="350" y="520" width="100" height="18" rx="4"/>
      <rect x="330" y="538" width="140" height="32" rx="6" fill="#9aa3ad"/>
      <path d="M400 95 Q330 92 290 120" stroke="#c7ced6" stroke-width="16" fill="none" stroke-linecap="round"/>
      <rect x="205" y="102" width="92" height="30" rx="15"/>
    </g>
    <circle cx="251" cy="117" r="46" fill="#8FC3FF" opacity="0.35"/>`,
  "braco-simples": `
    <g stroke="#c7ced6" stroke-width="22" fill="none" stroke-linecap="round">
      <path d="M260 460 V 260 Q260 200 330 188 L540 152"/>
    </g>
    <rect x="525" y="128" width="110" height="42" rx="21" fill="#c7ced6"/>
    <rect x="238" y="250" width="44" height="60" rx="8" fill="#9aa3ad"/>`,
  "braco-duplo": `
    <g stroke="#c7ced6" stroke-width="20" fill="none" stroke-linecap="round">
      <path d="M400 470 V 300"/>
      <path d="M400 300 Q400 240 330 226 L180 196"/>
      <path d="M400 300 Q400 240 470 226 L620 196"/>
    </g>
    <rect x="105" y="172" width="100" height="38" rx="19" fill="#c7ced6"/>
    <rect x="595" y="172" width="100" height="38" rx="19" fill="#c7ced6"/>`,
  chumbador: `
    <g transform="translate(400 300) rotate(35)">
      <rect x="-14" y="-200" width="28" height="330" rx="6" fill="#c7ced6"/>
      <path d="M-14 130 Q-14 190 -70 190" stroke="#c7ced6" stroke-width="28" fill="none" stroke-linecap="round"/>
      <g fill="#9aa3ad">
        <rect x="-30" y="-200" width="60" height="22" rx="4"/>
        <rect x="-30" y="-160" width="60" height="22" rx="4"/>
      </g>
      <g stroke="#114F8C" stroke-width="3" opacity="0.7">${Array.from({ length: 12 }, (_, i) => `<line x1="-14" y1="${-120 + i * 18}" x2="14" y2="${-128 + i * 18}"/>`).join("")}</g>
    </g>`,
  celula: `
    <g transform="translate(400 320)">
      <ellipse cx="0" cy="40" rx="120" ry="34" fill="#9aa3ad"/>
      <path d="M-120 40 Q-120 -90 0 -90 Q120 -90 120 40 Z" fill="#c7ced6"/>
      <path d="M-70 -30 Q0 -64 70 -30" stroke="#114F8C" stroke-width="10" fill="none" opacity="0.8"/>
      <circle cx="0" cy="-10" r="18" fill="#8FC3FF" opacity="0.8"/>
    </g>`,
  caixa: `
    <g transform="translate(400 300)">
      <rect x="-130" y="-110" width="260" height="220" rx="18" fill="#c7ced6"/>
      <rect x="-100" y="-80" width="200" height="160" rx="10" fill="#114F8C" opacity="0.85"/>
      <g fill="#eaf6ff"><circle cx="-55" cy="-30" r="12"/><circle cx="0" cy="-30" r="12"/><circle cx="55" cy="-30" r="12"/></g>
      <rect x="-70" y="20" width="140" height="26" rx="8" fill="#eaf6ff" opacity="0.85"/>
      <g fill="#9aa3ad"><circle cx="-112" cy="-92" r="7"/><circle cx="112" cy="-92" r="7"/><circle cx="-112" cy="92" r="7"/><circle cx="112" cy="92" r="7"/></g>
    </g>`,
  balizador: `
    <g transform="translate(400 300)">
      <rect x="-26" y="-160" width="52" height="320" rx="14" fill="#c7ced6"/>
      <rect x="-26" y="-120" width="52" height="70" rx="8" fill="#eaf6ff"/>
      <rect x="-48" y="160" width="96" height="22" rx="8" fill="#9aa3ad"/>
      <ellipse cx="0" cy="-85" rx="120" ry="60" fill="#8FC3FF" opacity="0.22"/>
    </g>`,
  projetor: `
    <g transform="translate(400 300) rotate(-12)">
      <rect x="-140" y="-90" width="280" height="180" rx="22" fill="#c7ced6"/>
      <rect x="-110" y="-60" width="220" height="120" rx="12" fill="#eaf6ff"/>
      <g stroke="#9aa3ad" stroke-width="5">${Array.from({ length: 5 }, (_, i) => `<line x1="${-110 + i * 55}" y1="-60" x2="${-110 + i * 55}" y2="60"/>`).join("")}</g>
      <path d="M-40 90 L-60 150 H60 L40 90 Z" fill="#9aa3ad"/>
    </g>
    <ellipse cx="400" cy="180" rx="220" ry="70" fill="#8FC3FF" opacity="0.18"/>`,
  aplique: `
    <g transform="translate(400 300)">
      <rect x="-50" y="-110" width="100" height="220" rx="20" fill="#c7ced6"/>
      <path d="M-60 -120 L60 -120 L30 -190 L-30 -190 Z" fill="#8FC3FF" opacity="0.3"/>
      <path d="M-60 120 L60 120 L30 190 L-30 190 Z" fill="#8FC3FF" opacity="0.3"/>
      <rect x="-30" y="-104" width="60" height="14" rx="7" fill="#eaf6ff"/>
      <rect x="-30" y="90" width="60" height="14" rx="7" fill="#eaf6ff"/>
    </g>`,
};

// Case-study art: skyline + glowing street lights.
const caseArt = {
  kilamba: { accent: "#2D77C9", buildings: [60, 180, 120, 220, 90, 200, 140] },
  benguela: { accent: "#1d8ca8", buildings: [40, 90, 60, 110, 50, 80, 70] },
  lobito: { accent: "#365f96", buildings: [80, 140, 100, 170, 120, 90, 150] },
};

function frame(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a1422"/>
      <stop offset="1" stop-color="#114F8C"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.55">
      <stop offset="0" stop-color="#8FC3FF" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#8FC3FF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <rect width="800" height="600" fill="url(#glow)"/>
  ${content}
</svg>`;
}

const productsDir = path.join(root, "public", "images", "products");
mkdirSync(productsDir, { recursive: true });
for (const [name, art] of Object.entries(silhouettes)) {
  writeFileSync(path.join(productsDir, `${name}.svg`), frame(art));
}

const casesDir = path.join(root, "public", "images", "cases");
mkdirSync(casesDir, { recursive: true });
for (const [name, { accent, buildings }] of Object.entries(caseArt)) {
  const skyline = buildings
    .map((h, i) => `<rect x="${40 + i * 105}" y="${480 - h}" width="80" height="${h}" fill="#060d18"/>`)
    .join("");
  const lights = buildings
    .map(
      (_, i) =>
        `<g><rect x="${78 + i * 105}" y="380" width="5" height="100" fill="#9aa3ad"/><circle cx="${80 + i * 105}" cy="376" r="22" fill="#8FC3FF" opacity="0.5"/><circle cx="${80 + i * 105}" cy="376" r="7" fill="#eaf6ff"/></g>`,
    )
    .join("");
  const art = `<rect width="800" height="600" fill="${accent}" opacity="0.12"/>${skyline}${lights}<rect y="480" width="800" height="120" fill="#04090f"/>`;
  writeFileSync(path.join(casesDir, `${name}.svg`), frame(art));
}

mkdirSync(path.join(root, "public", "uploads"), { recursive: true });
writeFileSync(path.join(root, "public", "uploads", ".gitkeep"), "");

console.log("Generated SVG art.");
