/**
 * Seed: sample Dufat, Lda. catalog.
 *
 * Luminaire data comes from the official Braytron BT42-99x32 fichas técnicas;
 * pole/arm/anchor pricing comes from the Dufat "Preçário Postes e Acessórios".
 * Case studies are illustrative sample content.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type SpecInput = { group: string; label: string; value: string };

type ProductInput = {
  slug: string;
  sku?: string;
  name: string;
  modelCode?: string;
  shortDescription: string;
  description: string;
  heroImage: string;
  priceKz?: string;
  wattage?: number;
  lumens?: number;
  featured?: boolean;
  has3dViewer?: boolean;
  /** TurntableVariant staged instead of the photo — see showcaseVariants.ts. */
  viewer3dVariant?: string;
  category: string;
  specs: SpecInput[];
};

const categories = [
  {
    slug: "iluminacao-publica",
    name: "Iluminação Pública LED",
    description:
      "Luminárias públicas LED de alto rendimento para avenidas, ruas e espaços urbanos.",
    sortOrder: 0,
  },
  {
    slug: "postes-e-bracos",
    name: "Postes e Braços",
    description:
      "Postes octogonais e cilíndricos galvanizados a quente, braços simples e duplos.",
    sortOrder: 1,
  },
  {
    slug: "iluminacao-decorativa",
    name: "Iluminação Decorativa",
    description:
      "Balizadores, apliques e projetores para jardins, fachadas e espaços comerciais.",
    sortOrder: 2,
  },
  {
    slug: "acessorios-eletricos",
    name: "Acessórios Elétricos",
    description:
      "Chumbadores, células fotoelétricas, caixas de derivação e material de instalação.",
    sortOrder: 3,
  },
];

const braytronCommonSpecs = (model: string): SpecInput[] => [
  { group: "Características Gerais", label: "Modelo", value: model },
  { group: "Características Gerais", label: "Família Principal", value: "Iluminação Externa" },
  { group: "Características Gerais", label: "Subfamília", value: "Luminária Pública LED" },
  { group: "Características Gerais", label: "Cor do Corpo", value: "Cinza" },
  { group: "Características Gerais", label: "Fonte de Luz", value: "LED" },
  { group: "Características Gerais", label: "Garantia", value: "2 Anos" },
  { group: "Características Gerais", label: "Classe", value: "CLASSE I" },
  { group: "Características Gerais", label: "Índice de Proteção (IP)", value: "IP66" },
  { group: "Características do Produto", label: "Temperatura de Cor", value: "6500K CoolDaylight" },
  { group: "Características do Produto", label: "Índice de Reprodução de Cor (IRC)", value: "≥70" },
  { group: "Características do Produto", label: "Classe de Eficiência Energética", value: "E" },
  { group: "Características do Produto", label: "Ângulo do Feixe", value: "70x140°" },
  { group: "Características Elétricas", label: "Vida Útil", value: "20 000 h" },
  { group: "Características Elétricas", label: "Tensão", value: "220–240V 50/60Hz" },
  { group: "Características Elétricas", label: "Fator de Potência", value: ">0,9" },
  { group: "Características Elétricas", label: "Material", value: "Alumínio" },
  { group: "Características Elétricas", label: "Temperatura de Operação", value: "-20°C ~ +40°C" },
];

const products: ProductInput[] = [
  {
    slug: "luminaria-publica-led-st89-200w",
    sku: "BT42-99632",
    name: "Luminária Pública LED ST89 200W",
    modelCode: "BT42-99632",
    shortDescription:
      "Luminária pública LED de 200W com 22 000 lm — o topo da gama ST89 para grandes avenidas.",
    description:
      "A ST89 de 200W é a luminária de referência da Dufat para iluminação de grandes avenidas e vias rápidas. Corpo em alumínio cinza com proteção IP66, fluxo luminoso de 22 000 lúmen a 6500K CoolDaylight e ótica 70x140° otimizada para distribuição viária. Montagem em braço Ø60 mm com ajuste de inclinação.",
    heroImage: "/images/products/luminaria-st89.svg",
    wattage: 200,
    lumens: 22000,
    featured: true,
    has3dViewer: true,
    category: "iluminacao-publica",
    specs: [
      ...braytronCommonSpecs("BT42-99632"),
      { group: "Características do Produto", label: "Potência", value: "200 W" },
      { group: "Características do Produto", label: "Fluxo Luminoso", value: "22 000 lm" },
      { group: "Dimensões e Peso", label: "Comprimento", value: "236 mm" },
      { group: "Dimensões e Peso", label: "Largura", value: "84 mm" },
      { group: "Dimensões e Peso", label: "Altura", value: "610 mm" },
      { group: "Dimensões e Peso", label: "Peso", value: "1 800 g" },
      { group: "Informações da Embalagem", label: "Peças por Caixa", value: "5" },
      { group: "Informações da Embalagem", label: "Código EAN", value: "5949097732294" },
    ],
  },
  {
    slug: "luminaria-publica-led-st89-150w",
    sku: "BT42-99432",
    name: "Luminária Pública LED ST89 150W",
    modelCode: "BT42-99432",
    shortDescription:
      "Luminária pública LED de 150W com 16 500 lm — equilíbrio ideal entre potência e eficiência.",
    description:
      "A ST89 de 150W ilumina ruas principais e secundárias com 16 500 lúmen a 6500K. Corpo em alumínio IP66, driver de fator de potência >0,9 e vida útil de 20 000 horas. A escolha mais popular para projetos municipais.",
    heroImage: "/images/products/luminaria-st89.svg",
    wattage: 150,
    lumens: 16500,
    featured: true,
    has3dViewer: true,
    category: "iluminacao-publica",
    specs: [
      ...braytronCommonSpecs("BT42-99432"),
      { group: "Características do Produto", label: "Potência", value: "150 W" },
      { group: "Características do Produto", label: "Fluxo Luminoso", value: "16 500 lm" },
      { group: "Dimensões e Peso", label: "Comprimento", value: "212 mm" },
      { group: "Dimensões e Peso", label: "Largura", value: "84 mm" },
      { group: "Dimensões e Peso", label: "Altura", value: "553 mm" },
      { group: "Dimensões e Peso", label: "Peso", value: "1 500 g" },
      { group: "Informações da Embalagem", label: "Peças por Caixa", value: "10" },
      { group: "Informações da Embalagem", label: "Código EAN", value: "5949097732270" },
    ],
  },
  {
    slug: "luminaria-publica-led-st89-100w",
    sku: "BT42-99132",
    name: "Luminária Pública LED ST89 100W",
    modelCode: "BT42-99132",
    shortDescription:
      "Luminária pública LED de 100W com 11 000 lm — eficiência para ruas residenciais e parques.",
    description:
      "A ST89 de 100W é a solução compacta da gama para ruas residenciais, parques de estacionamento e zonas pedonais. 11 000 lúmen a 6500K, corpo em alumínio IP66 e ótica viária 70x140°.",
    heroImage: "/images/products/luminaria-st89.svg",
    wattage: 100,
    lumens: 11000,
    featured: true,
    has3dViewer: true,
    category: "iluminacao-publica",
    specs: [
      ...braytronCommonSpecs("BT42-99132"),
      { group: "Características do Produto", label: "Potência", value: "100 W" },
      { group: "Características do Produto", label: "Fluxo Luminoso", value: "11 000 lm" },
      { group: "Dimensões e Peso", label: "Comprimento", value: "186 mm" },
      { group: "Dimensões e Peso", label: "Largura", value: "84 mm" },
      { group: "Dimensões e Peso", label: "Altura", value: "483 mm" },
      { group: "Dimensões e Peso", label: "Peso", value: "1 108 g" },
      { group: "Informações da Embalagem", label: "Peças por Caixa", value: "10" },
      { group: "Informações da Embalagem", label: "Código EAN", value: "5949097732256" },
    ],
  },
  {
    slug: "poste-octogonal-galvanizado",
    name: "Poste Octogonal Galvanizado",
    shortDescription:
      "Postes octogonais galvanizados a quente, de 2 a 12 metros, prontos para qualquer projeto viário.",
    description:
      "Postes octogonais em aço galvanizado a quente por imersão, com flange de base e portinhola de inspeção. Disponíveis de 2 a 12 metros de altura, compatíveis com braços simples e duplos Dufat.",
    heroImage: "/images/products/poste-octogonal.svg",
    priceKz: "55000.00",
    featured: true,
    category: "postes-e-bracos",
    specs: [
      { group: "Material e Acabamento", label: "Secção", value: "Octogonal" },
      { group: "Material e Acabamento", label: "Acabamento", value: "Galvanizado a quente" },
      { group: "Material e Acabamento", label: "Fixação", value: "Flange + chumbadores" },
      { group: "Preçário", label: "2 metros", value: "55 000,00 Kz" },
      { group: "Preçário", label: "3 metros", value: "75 000,00 Kz" },
      { group: "Preçário", label: "4 metros", value: "115 000,00 Kz" },
      { group: "Preçário", label: "5 metros", value: "135 000,00 Kz" },
      { group: "Preçário", label: "6 metros", value: "160 000,00 Kz" },
      { group: "Preçário", label: "7 metros", value: "195 000,00 Kz" },
      { group: "Preçário", label: "8 metros", value: "245 000,00 Kz" },
      { group: "Preçário", label: "9 metros", value: "295 000,00 Kz" },
      { group: "Preçário", label: "10 metros", value: "330 000,00 Kz" },
      { group: "Preçário", label: "12 metros", value: "455 000,00 Kz" },
    ],
  },
  {
    slug: "poste-cilindrico-galvanizado",
    name: "Poste Cilíndrico Galvanizado",
    shortDescription:
      "Postes cilíndricos galvanizados a quente, de 2 a 12 metros, com flange e portinhola.",
    description:
      "Postes cilíndricos em aço galvanizado a quente, ideais para iluminação urbana e decorativa. Disponíveis de 2 a 12 metros, com portinhola de inspeção e fixação por flange e chumbadores.",
    heroImage: "/images/products/poste-cilindrico.svg",
    priceKz: "55000.00",
    // The pole cut out of candeeiro.glb is exactly this product.
    has3dViewer: true,
    viewer3dVariant: "pole",
    category: "postes-e-bracos",
    specs: [
      { group: "Material e Acabamento", label: "Secção", value: "Cilíndrica" },
      { group: "Material e Acabamento", label: "Acabamento", value: "Galvanizado a quente" },
      { group: "Material e Acabamento", label: "Fixação", value: "Flange + chumbadores" },
      { group: "Preçário", label: "2 metros", value: "55 000,00 Kz" },
      { group: "Preçário", label: "3 metros", value: "75 000,00 Kz" },
      { group: "Preçário", label: "4 metros", value: "115 000,00 Kz" },
      { group: "Preçário", label: "5 metros", value: "135 000,00 Kz" },
      { group: "Preçário", label: "6 metros", value: "160 000,00 Kz" },
      { group: "Preçário", label: "7 metros", value: "195 000,00 Kz" },
      { group: "Preçário", label: "8 metros", value: "245 000,00 Kz" },
      { group: "Preçário", label: "9 metros", value: "295 000,00 Kz" },
      { group: "Preçário", label: "10 metros", value: "330 000,00 Kz" },
      { group: "Preçário", label: "12 metros", value: "455 000,00 Kz" },
    ],
  },
  {
    slug: "braco-simples-galvanizado",
    name: "Braço Simples Galvanizado",
    shortDescription:
      "Braço simples com inclinação de 15°, comprimentos de 1,00 a 1,50 m, para luminárias Ø60.",
    description:
      "Braço simples em aço galvanizado com inclinação de 15°, para montagem de uma luminária por poste. Disponível em três comprimentos, com abraçadeiras de fixação incluídas.",
    heroImage: "/images/products/braco-simples.svg",
    priceKz: "25000.00",
    // The single arm cut out of candeeiro.glb.
    has3dViewer: true,
    viewer3dVariant: "arm",
    category: "postes-e-bracos",
    specs: [
      { group: "Características", label: "Inclinação", value: "15°" },
      { group: "Características", label: "Acabamento", value: "Galvanizado" },
      { group: "Preçário", label: "Simples 1x600 mm", value: "25 000,00 Kz" },
      { group: "Preçário", label: "Simples 1,25x600 mm", value: "28 000,00 Kz" },
      { group: "Preçário", label: "Simples 1,50x600 mm", value: "35 000,00 Kz" },
    ],
  },
  {
    slug: "braco-duplo-galvanizado",
    name: "Braço Duplo Galvanizado",
    shortDescription:
      "Braço duplo com inclinação de 15° para duas luminárias — ideal para avenidas com separador central.",
    description:
      "Braço duplo em aço galvanizado com inclinação de 15°, para montagem de duas luminárias opostas no mesmo poste. A solução clássica para avenidas com separador central.",
    heroImage: "/images/products/braco-duplo.svg",
    priceKz: "42000.00",
    category: "postes-e-bracos",
    specs: [
      { group: "Características", label: "Inclinação", value: "15°" },
      { group: "Características", label: "Acabamento", value: "Galvanizado" },
      { group: "Preçário", label: "Duplo 1x600 mm", value: "42 000,00 Kz" },
      { group: "Preçário", label: "Duplo 1,25x600 mm", value: "45 000,00 Kz" },
      { group: "Preçário", label: "Duplo 1,50x600 mm", value: "56 000,00 Kz" },
    ],
  },
  {
    slug: "chumbadores-jogo-4",
    name: "Chumbadores (Jogo de 4)",
    shortDescription:
      "Jogos de 4 chumbadores em J para fundação de postes — 16 a 20 mm de diâmetro.",
    description:
      "Chumbadores em J com rosca e porcas, fornecidos em jogos de 4 unidades para fixação de flanges de poste em fundações de betão.",
    heroImage: "/images/products/chumbador.svg",
    priceKz: "15800.00",
    category: "acessorios-eletricos",
    specs: [
      { group: "Preçário", label: "16 mm x 600 mm (4 pcs)", value: "15 800,00 Kz" },
      { group: "Preçário", label: "20 mm x 860 mm (4 pcs)", value: "22 000,00 Kz" },
      { group: "Preçário", label: "20 mm x 1060 mm (4 pcs)", value: "24 000,00 Kz" },
    ],
  },
  {
    slug: "celula-fotoeletrica-10a",
    name: "Célula Fotoelétrica 10A",
    shortDescription:
      "Comando automático liga/desliga ao anoitecer para luminárias até 2200 VA.",
    description:
      "Célula fotoelétrica com base NEMA para comando automático da iluminação pública: liga ao anoitecer, desliga ao amanhecer. Capacidade de 10A a 220V, proteção contra surtos integrada.",
    heroImage: "/images/products/celula.svg",
    category: "acessorios-eletricos",
    specs: [
      { group: "Características", label: "Tensão", value: "220–240 V" },
      { group: "Características", label: "Corrente máxima", value: "10 A" },
      { group: "Características", label: "Base", value: "NEMA" },
      { group: "Características", label: "Proteção", value: "IP65" },
    ],
  },
  {
    slug: "caixa-derivacao-ip65",
    name: "Caixa de Derivação IP65",
    shortDescription:
      "Caixa estanque para derivação de cabos em coluna, com porta-fusível.",
    description:
      "Caixa de derivação estanque IP65 para instalação na portinhola do poste, com bornes de derivação e porta-fusível de proteção da luminária.",
    heroImage: "/images/products/caixa.svg",
    category: "acessorios-eletricos",
    specs: [
      { group: "Características", label: "Proteção", value: "IP65" },
      { group: "Características", label: "Bornes", value: "4 x 25 mm²" },
      { group: "Características", label: "Fusível", value: "1 x 6A" },
    ],
  },
  {
    slug: "balizador-led-jardim",
    name: "Balizador LED de Jardim 10W",
    shortDescription:
      "Baliza LED de exterior para caminhos e jardins, corpo em alumínio antracite.",
    description:
      "Balizador LED de 10W para marcação de caminhos pedonais, jardins e acessos. Corpo em alumínio antracite com difusor opalino, luz 3000K confortável e proteção IP54.",
    heroImage: "/images/products/balizador.svg",
    wattage: 10,
    lumens: 800,
    category: "iluminacao-decorativa",
    specs: [
      { group: "Características", label: "Potência", value: "10 W" },
      { group: "Características", label: "Fluxo Luminoso", value: "800 lm" },
      { group: "Características", label: "Temperatura de Cor", value: "3000K" },
      { group: "Características", label: "Proteção", value: "IP54" },
      { group: "Características", label: "Altura", value: "600 mm" },
    ],
  },
  {
    slug: "projetor-led-50w",
    name: "Projetor LED 50W",
    shortDescription:
      "Projetor LED compacto para fachadas, montras e áreas exteriores.",
    description:
      "Projetor LED de 50W com corpo em alumínio e vidro temperado, ideal para iluminação de fachadas, painéis publicitários e pequenas áreas desportivas. 6500K, IP65.",
    heroImage: "/images/products/projetor.svg",
    wattage: 50,
    lumens: 4500,
    category: "iluminacao-decorativa",
    specs: [
      { group: "Características", label: "Potência", value: "50 W" },
      { group: "Características", label: "Fluxo Luminoso", value: "4 500 lm" },
      { group: "Características", label: "Temperatura de Cor", value: "6500K" },
      { group: "Características", label: "Proteção", value: "IP65" },
    ],
  },
  {
    slug: "aplique-parede-led-exterior",
    name: "Aplique de Parede LED Exterior",
    shortDescription:
      "Aplique up/down em alumínio para fachadas residenciais e comerciais.",
    description:
      "Aplique de parede LED com emissão dupla (up/down) para destacar fachadas e entradas. Corpo em alumínio cinza, 2x5W a 3000K, proteção IP54.",
    heroImage: "/images/products/aplique.svg",
    wattage: 10,
    lumens: 700,
    category: "iluminacao-decorativa",
    specs: [
      { group: "Características", label: "Potência", value: "2 x 5 W" },
      { group: "Características", label: "Temperatura de Cor", value: "3000K" },
      { group: "Características", label: "Proteção", value: "IP54" },
    ],
  },
];

const caseStudies = [
  {
    slug: "avenidas-de-kilamba",
    title: "Avenidas de Kilamba",
    client: "Administração Municipal (exemplo)",
    location: "Kilamba, Luanda",
    summary:
      "Modernização de 1 200 pontos de luz com luminárias LED ST89 de 150W em postes octogonais de 10 metros.",
    body: "A centralidade do Kilamba precisava de substituir luminárias de vapor de sódio envelhecidas por uma solução LED eficiente. A Dufat forneceu 1 200 luminárias ST89 de 150W montadas em braços duplos sobre postes octogonais galvanizados de 10 metros ao longo das avenidas principais.\n\nO resultado: redução de 58% no consumo de energia, uniformidade luminosa superior e uma manutenção drasticamente reduzida graças às 20 000 horas de vida útil de cada luminária.\n\nO projeto incluiu fornecimento de chumbadores, caixas de derivação com proteção por fusível e células fotoelétricas para comando automático ao anoitecer.",
    heroImage: "/images/cases/kilamba.svg",
    stats: [
      { label: "Pontos de luz", value: "1 200" },
      { label: "Redução de consumo", value: "58%" },
      { label: "Quilómetros iluminados", value: "14 km" },
    ],
    sortOrder: 0,
  },
  {
    slug: "marginal-de-benguela",
    title: "Marginal de Benguela",
    client: "Governo Provincial (exemplo)",
    location: "Benguela",
    summary:
      "Iluminação cénica e viária da marginal com postes cilíndricos de 8 metros e luminárias de 100W.",
    body: "A marginal de Benguela pedia uma iluminação que valorizasse o passeio marítimo sem ofuscar os residentes. A Dufat combinou postes cilíndricos galvanizados de 8 metros com luminárias ST89 de 100W na via e balizadores LED de 10W nos passeios pedonais.\n\nA proteção IP66 das luminárias e a galvanização a quente dos postes garantem resistência à atmosfera salina da orla atlântica.\n\nForam instalados 340 pontos de luz ao longo de 4,5 km de marginal, com células fotoelétricas em cada circuito.",
    heroImage: "/images/cases/benguela.svg",
    stats: [
      { label: "Pontos de luz", value: "340" },
      { label: "Extensão", value: "4,5 km" },
      { label: "Resistência", value: "IP66 + galvanização" },
    ],
    sortOrder: 1,
  },
  {
    slug: "centralidade-do-lobito",
    title: "Centralidade do Lobito",
    client: "Empreiteiro Geral (exemplo)",
    location: "Lobito, Benguela",
    summary:
      "Infraestrutura completa de iluminação para uma nova centralidade: 600 postes, braços e rede de comando.",
    body: "Num projeto de raiz, a Dufat forneceu a infraestrutura completa de iluminação pública para a nova centralidade do Lobito: 600 postes octogonais de 9 metros, braços simples e duplos, chumbadores e caixas de derivação.\n\nAs ruas principais receberam luminárias ST89 de 200W com 22 000 lúmen; as ruas residenciais, unidades de 100W — uma hierarquia luminosa que poupa energia onde a potência não é necessária.\n\nO fornecimento faseado e o acompanhamento técnico em obra garantiram a entrega dentro do prazo do empreiteiro.",
    heroImage: "/images/cases/lobito.svg",
    stats: [
      { label: "Postes instalados", value: "600" },
      { label: "Potências", value: "100W–200W" },
      { label: "Prazo", value: "Entregue a tempo" },
    ],
    sortOrder: 2,
  },
];

async function main() {
  console.log("Seeding Dufat catalog…");

  // Admin user
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@dufat.co.ao";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "dufat-admin-2026";
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, name: "Administrador Dufat", passwordHash, role: "ADMIN" },
  });
  console.log(`  admin user: ${adminEmail}`);

  // Categories
  const categoryIds = new Map<string, string>();
  for (const category of categories) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
    categoryIds.set(category.slug, row.id);
  }
  console.log(`  ${categories.length} categories`);

  // Products + specs
  for (const { category, specs, ...product } of products) {
    const categoryId = categoryIds.get(category)!;
    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      update: { ...product, categoryId },
      create: { ...product, categoryId },
    });
    await prisma.spec.deleteMany({ where: { productId: row.id } });
    await prisma.spec.createMany({
      data: specs.map((spec, index) => ({ ...spec, productId: row.id, sortOrder: index })),
    });
  }
  console.log(`  ${products.length} products`);

  // Case studies
  for (const study of caseStudies) {
    await prisma.caseStudy.upsert({
      where: { slug: study.slug },
      update: study,
      create: study,
    });
  }
  console.log(`  ${caseStudies.length} case studies`);

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
