/**
 * Seed: "Funcionário do Mês" reference data.
 *
 * Run with no arguments to create only the organisational reference data —
 * departments, cargos and activity categories — which is safe against a live
 * database: everything is upserted by slug and nothing existing is touched.
 *
 *   npm run db:seed:premios
 *
 * Pass --demo to additionally create eight sample employees and a full month of
 * activity for them, each deliberately exercising a different rule (bulk
 * logging, fragmentation, rejections, part time, a mid-month hire). Never run
 * that against production.
 *
 *   npm run db:seed:premios -- --demo
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const departamentos = [
  { slug: "comercial", nome: "Comercial", sortOrder: 0 },
  { slug: "operacoes-obra", nome: "Operações e Obra", sortOrder: 1 },
  { slug: "armazem-logistica", nome: "Armazém e Logística", sortOrder: 2 },
  { slug: "financeiro-administrativo", nome: "Financeiro e Administrativo", sortOrder: 3 },
  { slug: "direcao", nome: "Direção", sortOrder: 4 },
];

/**
 * Deliberately broad.
 *
 * The cargo is the unit of comparison: volume and hours are normalised against
 * the median of the employee's own cargo, and a cargo with fewer than
 * `minPorCargo` people (3 by default) has no usable median and falls back to
 * history or to the company. Splitting "Técnico de Instalação" into electrician,
 * installer and assistant would therefore make the scoring *less* fair, not
 * more precise. Merge rather than split whenever two roles do comparable work.
 */
const cargos = [
  { slug: "comercial", nome: "Comercial", diasSemana: 5 },
  { slug: "orcamentista", nome: "Orçamentista", diasSemana: 5 },
  { slug: "tecnico-instalacao", nome: "Técnico de Instalação", diasSemana: 5 },
  { slug: "encarregado-obra", nome: "Encarregado de Obra", diasSemana: 5 },
  { slug: "fiel-armazem", nome: "Fiel de Armazém", diasSemana: 5 },
  { slug: "motorista", nome: "Motorista", diasSemana: 5 },
  { slug: "caixa", nome: "Caixa", diasSemana: 5 },
  { slug: "contabilista", nome: "Contabilista", diasSemana: 5 },
  { slug: "gestor-compras", nome: "Gestor de Compras", diasSemana: 5 },
  { slug: "assistente-administrativo", nome: "Assistente Administrativo", diasSemana: 5 },
];

/**
 * What an employee picks when logging work.
 *
 * Written around what DUFAT actually does — selling and quoting lighting,
 * installing it, and keeping stock and books — because a category nobody
 * recognises gets ignored in favour of "Outro", and "Outro" is what the
 * penalty exists to discourage.
 */
const categorias = [
  { slug: "atendimento", nome: "Atendimento ao cliente", sortOrder: 0 },
  { slug: "orcamentos", nome: "Elaboração de orçamentos", sortOrder: 1 },
  { slug: "faturacao", nome: "Faturação e caixa", sortOrder: 2 },
  { slug: "stock", nome: "Conferência e movimentos de stock", sortOrder: 3 },
  { slug: "rececao-expedicao", nome: "Receção e expedição de mercadoria", sortOrder: 4 },
  { slug: "instalacao", nome: "Instalação em obra", sortOrder: 5 },
  { slug: "manutencao", nome: "Manutenção e assistência técnica", sortOrder: 6 },
  { slug: "levantamento", nome: "Levantamento técnico e visita a obra", sortOrder: 7 },
  { slug: "compras", nome: "Compras e fornecedores", sortOrder: 8 },
  { slug: "contabilidade", nome: "Contabilidade e fecho", sortOrder: 9 },
  { slug: "reuniao", nome: "Reuniões", sortOrder: 10 },
  { slug: "formacao", nome: "Formação", sortOrder: 11 },
  { slug: "deslocacao", nome: "Deslocações", sortOrder: 12 },
  // The catch-all. More than `limiteOutroPct` of validated hours here costs
  // points, because a month of unlabelled work cannot be assessed.
  { slug: "outro", nome: "Outro", isOutro: true, sortOrder: 13 },
];

async function seedReferencia() {
  for (const departamento of departamentos) {
    await prisma.departamento.upsert({
      where: { slug: departamento.slug },
      update: departamento,
      create: departamento,
    });
  }
  console.log(`  ${departamentos.length} departamentos`);

  for (const cargo of cargos) {
    await prisma.cargo.upsert({ where: { slug: cargo.slug }, update: cargo, create: cargo });
  }
  console.log(`  ${cargos.length} cargos`);

  for (const categoria of categorias) {
    await prisma.categoriaAtividade.upsert({
      where: { slug: categoria.slug },
      update: categoria,
      create: categoria,
    });
  }
  console.log(`  ${categorias.length} categorias de atividade`);

  await prisma.awardSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  console.log("  parâmetros do prémio (valores por omissão)");
}

/* ------------------------------------------------------------------ */
/* Demo dataset                                                        */
/* ------------------------------------------------------------------ */

type PerfilDemo = {
  nome: string;
  email: string;
  cargo: string;
  departamento: string;
  /** Days per week; 5 unless part time. */
  diasSemana?: number;
  /** Day of the month they were hired, for the mid-month-hire case. */
  admissaoDia?: number;
  /** Roughly how many entries per working day. */
  entradasPorDia: number;
  /** Typical entry length in minutes. */
  minutosPorEntrada: number;
  /** Fraction of working days they log at all. */
  coberturaDias: number;
  /** Days between doing the work and recording it. */
  atrasoRegisto: number;
  /** How many entries end up rejected. */
  rejeitadas: number;
  /** How many end up questioned then validated. */
  questionadas: number;
  /** Share of hours dumped into "Outro". */
  fracaoOutro: number;
  categorias: string[];
};

const perfis: PerfilDemo[] = [
  {
    nome: "Ana Bumba",
    email: "ana.bumba@dufat.co.ao",
    cargo: "caixa",
    departamento: "comercial",
    entradasPorDia: 6,
    minutosPorEntrada: 55,
    coberturaDias: 1,
    atrasoRegisto: 0,
    rejeitadas: 0,
    questionadas: 0,
    fracaoOutro: 0.05,
    categorias: ["atendimento", "faturacao"],
  },
  {
    nome: "Joaquim Neto",
    email: "joaquim.neto@dufat.co.ao",
    cargo: "caixa",
    departamento: "comercial",
    entradasPorDia: 5,
    minutosPorEntrada: 50,
    coberturaDias: 0.9,
    // Logs the whole month in one sitting at the end — the punctuality case.
    atrasoRegisto: 12,
    rejeitadas: 0,
    questionadas: 1,
    fracaoOutro: 0.1,
    categorias: ["atendimento", "faturacao"],
  },
  {
    nome: "Teresa Kiala",
    email: "teresa.kiala@dufat.co.ao",
    cargo: "caixa",
    departamento: "comercial",
    // Twenty-two tiny entries a day: the fragmentation case. Anti-gaming should
    // stop this beating Ana on volume.
    entradasPorDia: 22,
    minutosPorEntrada: 7,
    coberturaDias: 0.95,
    atrasoRegisto: 1,
    rejeitadas: 0,
    questionadas: 0,
    fracaoOutro: 0.05,
    categorias: ["atendimento", "faturacao"],
  },
  {
    nome: "Domingos Bastos",
    email: "domingos.bastos@dufat.co.ao",
    cargo: "contabilista",
    departamento: "financeiro-administrativo",
    entradasPorDia: 3,
    minutosPorEntrada: 130,
    coberturaDias: 1,
    atrasoRegisto: 0,
    rejeitadas: 0,
    questionadas: 0,
    fracaoOutro: 0.08,
    categorias: ["contabilidade", "reuniao"],
  },
  {
    nome: "Lucrécia Ferraz",
    email: "lucrecia.ferraz@dufat.co.ao",
    cargo: "contabilista",
    departamento: "financeiro-administrativo",
    entradasPorDia: 3,
    minutosPorEntrada: 115,
    coberturaDias: 0.85,
    atrasoRegisto: 2,
    // Over the limit of 2 — the rejection-based ineligibility case.
    rejeitadas: 3,
    questionadas: 1,
    fracaoOutro: 0.12,
    categorias: ["contabilidade", "orcamentos"],
  },
  {
    nome: "Paulino Cassoma",
    email: "paulino.cassoma@dufat.co.ao",
    cargo: "tecnico-instalacao",
    departamento: "operacoes-obra",
    entradasPorDia: 3,
    minutosPorEntrada: 160,
    coberturaDias: 1,
    atrasoRegisto: 1,
    rejeitadas: 0,
    questionadas: 0,
    // Most hours unlabelled — should trigger the "Outro" penalty.
    fracaoOutro: 0.45,
    categorias: ["instalacao", "manutencao"],
  },
  {
    nome: "Isabel Mendonça",
    email: "isabel.mendonca@dufat.co.ao",
    cargo: "tecnico-instalacao",
    departamento: "operacoes-obra",
    // Three days a week — the part-time case. Pro-rating should keep her
    // eligible and her consistency score fair.
    diasSemana: 3,
    entradasPorDia: 3,
    minutosPorEntrada: 150,
    coberturaDias: 1,
    atrasoRegisto: 0,
    rejeitadas: 0,
    questionadas: 0,
    fracaoOutro: 0.1,
    categorias: ["instalacao", "manutencao"],
  },
  {
    nome: "Nelson Quixi",
    email: "nelson.quixi@dufat.co.ao",
    cargo: "fiel-armazem",
    departamento: "armazem-logistica",
    // Hired on the 18th — cannot reach a flat 15 days, so the pro-rated
    // minimum is what decides whether he is eligible.
    admissaoDia: 18,
    entradasPorDia: 5,
    minutosPorEntrada: 70,
    coberturaDias: 1,
    atrasoRegisto: 0,
    rejeitadas: 0,
    questionadas: 0,
    fracaoOutro: 0.05,
    categorias: ["stock", "deslocacao"],
  },
];

/** Deterministic PRNG so re-running the demo produces the same month. */
function rng(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

function diasUteis(ano: number, mes: number): Date[] {
  const out: Date[] = [];
  const d = new Date(Date.UTC(ano, mes - 1, 1));
  while (d.getUTCMonth() === mes - 1) {
    const dia = d.getUTCDay();
    if (dia >= 1 && dia <= 5) out.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

async function seedDemo(periodo: string) {
  const [anoStr, mesStr] = periodo.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr);

  const [cargoRows, depRows, catRows] = await Promise.all([
    prisma.cargo.findMany({ select: { id: true, slug: true } }),
    prisma.departamento.findMany({ select: { id: true, slug: true } }),
    prisma.categoriaAtividade.findMany({ select: { id: true, slug: true } }),
  ]);
  const cargoId = new Map(cargoRows.map((c) => [c.slug, c.id]));
  const depId = new Map(depRows.map((d) => [d.slug, d.id]));
  const catId = new Map(catRows.map((c) => [c.slug, c.id]));

  const passwordHash = await bcrypt.hash("dufat-demo-2026", 12);
  const uteis = diasUteis(ano, mes);
  const prazo = new Date(Date.UTC(ano, mes, 5));

  for (const [indice, perfil] of perfis.entries()) {
    const aleatorio = rng(indice * 7919 + 13);

    const user = await prisma.user.upsert({
      where: { email: perfil.email },
      update: {
        cargoId: cargoId.get(perfil.cargo) ?? null,
        departamentoId: depId.get(perfil.departamento) ?? null,
        diasSemana: perfil.diasSemana ?? null,
        dataAdmissao: perfil.admissaoDia
          ? new Date(Date.UTC(ano, mes - 1, perfil.admissaoDia))
          : new Date(Date.UTC(ano - 2, 0, 15)),
      },
      create: {
        email: perfil.email,
        name: perfil.nome,
        passwordHash,
        role: "COLABORADOR",
        cargoId: cargoId.get(perfil.cargo) ?? null,
        departamentoId: depId.get(perfil.departamento) ?? null,
        diasSemana: perfil.diasSemana ?? null,
        dataAdmissao: perfil.admissaoDia
          ? new Date(Date.UTC(ano, mes - 1, perfil.admissaoDia))
          : new Date(Date.UTC(ano - 2, 0, 15)),
      },
    });

    const folha = await prisma.folhaMensal.upsert({
      where: { userId_periodo: { userId: user.id, periodo } },
      update: { estado: "FECHADA", prazoSubmissao: prazo },
      create: { userId: user.id, periodo, estado: "FECHADA", prazoSubmissao: prazo },
    });
    await prisma.atividade.deleteMany({ where: { folhaId: folha.id } });

    // Part timers work a subset of the week; a mid-month hire starts late.
    const diasDoPerfil = uteis.filter((dia, i) => {
      if (perfil.admissaoDia && dia.getUTCDate() < perfil.admissaoDia) return false;
      if (perfil.diasSemana && perfil.diasSemana < 5 && i % 5 >= perfil.diasSemana) return false;
      return aleatorio() <= perfil.coberturaDias;
    });

    const linhas: {
      folhaId: string;
      userId: string;
      categoriaId: string;
      descricao: string;
      dia: Date;
      inicioEm: Date;
      fimEm: Date;
      minutos: number;
      estado: "VALIDADA" | "REJEITADA";
      jaQuestionada: boolean;
      possivelInconsistencia: boolean;
      registadaEm: Date;
    }[] = [];

    for (const dia of diasDoPerfil) {
      let minutoDoDia = 8 * 60;
      for (let n = 0; n < perfil.entradasPorDia; n += 1) {
        const minutos = Math.max(
          3,
          Math.round(perfil.minutosPorEntrada * (0.75 + aleatorio() * 0.5)),
        );
        const inicioEm = new Date(dia);
        inicioEm.setUTCMinutes(minutoDoDia);
        const fimEm = new Date(inicioEm.getTime() + minutos * 60_000);
        minutoDoDia += minutos + 5;

        const slug =
          aleatorio() < perfil.fracaoOutro
            ? "outro"
            : perfil.categorias[n % perfil.categorias.length]!;

        const registadaEm = new Date(dia);
        registadaEm.setUTCDate(registadaEm.getUTCDate() + perfil.atrasoRegisto);
        registadaEm.setUTCHours(17, 30);

        linhas.push({
          folhaId: folha.id,
          userId: user.id,
          categoriaId: catId.get(slug)!,
          descricao: `${slug} — registo ${n + 1} de ${dia.toISOString().slice(0, 10)}`,
          dia,
          inicioEm,
          fimEm,
          minutos,
          estado: "VALIDADA",
          jaQuestionada: false,
          possivelInconsistencia: minutos < 10 || perfil.entradasPorDia > 15,
          registadaEm,
        });
      }
    }

    // Mark the profile's rejections and questions on the last few entries.
    for (let n = 0; n < perfil.rejeitadas && n < linhas.length; n += 1) {
      linhas[linhas.length - 1 - n]!.estado = "REJEITADA";
    }
    for (let n = 0; n < perfil.questionadas && n < linhas.length; n += 1) {
      linhas[n]!.jaQuestionada = true;
    }

    await prisma.atividade.createMany({ data: linhas });
    console.log(
      `  ${perfil.nome.padEnd(20)} ${String(linhas.length).padStart(4)} atividades em ${diasDoPerfil.length} dias`,
    );
  }
}

async function main() {
  const demo = process.argv.includes("--demo");
  const periodoArg = process.argv.find((a) => /^\d{4}-\d{2}$/.test(a));

  console.log("A criar dados de referência do prémio…");
  await seedReferencia();

  if (demo) {
    const agora = new Date();
    const periodo =
      periodoArg ??
      `${agora.getUTCFullYear()}-${String(agora.getUTCMonth() + 1).padStart(2, "0")}`;
    console.log(`\nA criar dados de demonstração para ${periodo}…`);
    await seedDemo(periodo);
    console.log("\nColaboradores de demonstração criados com a password: dufat-demo-2026");
  } else {
    console.log("\n(Passe --demo para criar também colaboradores e atividades de exemplo.)");
  }

  console.log("\nConcluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
