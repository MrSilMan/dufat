import { z } from "zod";
import { TURNTABLE_VARIANTS } from "@/lib/three/showcaseVariants";

// ---------- Public forms ----------

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Indique o seu nome").max(120),
  email: z.email("Email inválido").max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s()-]*$/, "Telefone inválido")
    .optional()
    .or(z.literal("")),
  subject: z.string().trim().min(3, "Indique o assunto").max(160),
  message: z.string().trim().min(10, "Descreva o seu pedido (mín. 10 caracteres)").max(4000),
});

export const quoteSchema = z.object({
  name: z.string().trim().min(2, "Indique o seu nome").max(120),
  email: z.email("Email inválido").max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[+\d\s()-]*$/, "Telefone inválido")
    .optional()
    .or(z.literal("")),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  productSlug: z.string().trim().max(200).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1).max(1_000_000).optional(),
  message: z.string().trim().min(10, "Descreva o projeto (mín. 10 caracteres)").max(4000),
});

export const newsletterSchema = z.object({
  email: z.email("Email inválido").max(200),
});

// ---------- Admin ----------

export const loginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(8, "Password demasiado curta"),
});

const slugField = z
  .string()
  .trim()
  .min(2, "Indique o slug (mín. 2 caracteres)")
  .max(160, "Slug demasiado longo (máx. 160 caracteres)")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido (use letras minúsculas, números e hífens)");

/** Optional number field: rejects non-numeric input with a Portuguese message. */
const optionalNumber = (max: number, label: string, int = false) => {
  const base = z.coerce.number({ error: `${label} deve ser um número` });
  return (int ? base.int(`${label} deve ser um número inteiro`) : base)
    .min(0, `${label} não pode ser negativo`)
    .max(max, `${label} excede o máximo permitido`)
    .optional();
};

/**
 * Sentinel `categoryId` posted when the admin picks "+ Nova categoria…" in the
 * product form. The save action creates the category from `newCategoryName`.
 */
export const NEW_CATEGORY_VALUE = "__new__";

export const productSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Indique o nome do produto (mín. 2 caracteres)")
    .max(200, "Nome demasiado longo (máx. 200 caracteres)"),
  slug: slugField,
  sku: z.string().trim().max(60, "SKU demasiado longo (máx. 60 caracteres)").optional().or(z.literal("")),
  modelCode: z
    .string()
    .trim()
    .max(60, "Código do modelo demasiado longo (máx. 60 caracteres)")
    .optional()
    .or(z.literal("")),
  categoryId: z.string().min(1, "Escolha uma categoria"),
  /** Set only when categoryId is NEW_CATEGORY_VALUE — the name for the category to create. */
  newCategoryName: z
    .string()
    .trim()
    .max(80, "Nome da categoria demasiado longo (máx. 80 caracteres)")
    .optional()
    .or(z.literal("")),
  shortDescription: z
    .string()
    .trim()
    .min(10, "Descrição curta demasiado curta (mín. 10 caracteres)")
    .max(400, "Descrição curta demasiado longa (máx. 400 caracteres)"),
  description: z
    .string()
    .trim()
    .min(10, "Descrição completa demasiado curta (mín. 10 caracteres)")
    .max(8000, "Descrição completa demasiado longa (máx. 8000 caracteres)"),
  heroImage: z
    .string()
    .trim()
    .max(500, "Endereço da imagem demasiado longo (máx. 500 caracteres)")
    .optional()
    .or(z.literal("")),
  // Matches the Decimal(12,2) column: 10 integer digits + 2 decimals. Extra
  // decimals are rejected rather than silently rounded by Postgres on write.
  priceKz: optionalNumber(9_999_999_999.99, "O preço").refine(
    (value) => value === undefined || Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    "O preço só pode ter até 2 casas decimais",
  ),
  wattage: optionalNumber(10_000, "A potência", true),
  lumens: optionalNumber(1_000_000, "O fluxo luminoso", true),
  featured: z.coerce.boolean().default(false),
  published: z.coerce.boolean().default(true),
  has3dViewer: z.coerce.boolean().default(false),
  /** Empty = fall back to the category's model. */
  viewer3dVariant: z
    .enum(TURNTABLE_VARIANTS, { message: "Modelo 3D desconhecido" })
    .optional()
    .or(z.literal("")),
  /** One spec per line: "Grupo | Etiqueta | Valor" */
  specsText: z
    .string()
    .max(20_000, "Especificações demasiado longas (máx. 20000 caracteres)")
    .optional()
    .or(z.literal("")),
}).superRefine((data, ctx) => {
  // "+ Nova categoria…" requires a name to create the category from.
  if (data.categoryId === NEW_CATEGORY_VALUE && !data.newCategoryName) {
    ctx.addIssue({
      code: "custom",
      path: ["newCategoryName"],
      message: "Indique o nome da nova categoria",
    });
  }
});

export const caseStudySchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Indique o título (mín. 2 caracteres)")
    .max(200, "Título demasiado longo (máx. 200 caracteres)"),
  slug: slugField,
  client: z
    .string()
    .trim()
    .min(2, "Indique o cliente (mín. 2 caracteres)")
    .max(200, "Nome do cliente demasiado longo (máx. 200 caracteres)"),
  location: z
    .string()
    .trim()
    .min(2, "Indique a localização (mín. 2 caracteres)")
    .max(200, "Localização demasiado longa (máx. 200 caracteres)"),
  summary: z
    .string()
    .trim()
    .min(10, "Resumo demasiado curto (mín. 10 caracteres)")
    .max(600, "Resumo demasiado longo (máx. 600 caracteres)"),
  body: z
    .string()
    .trim()
    .min(10, "Corpo demasiado curto (mín. 10 caracteres)")
    .max(20_000, "Corpo demasiado longo (máx. 20000 caracteres)"),
  heroImage: z
    .string()
    .trim()
    .max(500, "Endereço da imagem demasiado longo (máx. 500 caracteres)")
    .optional()
    .or(z.literal("")),
  /** One stat per line: "Etiqueta | Valor" */
  statsText: z
    .string()
    .max(4000, "Estatísticas demasiado longas (máx. 4000 caracteres)")
    .optional()
    .or(z.literal("")),
  published: z.coerce.boolean().default(true),
  sortOrder: optionalNumber(9999, "A ordem", true).unwrap().default(0),
});

export const quoteStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["NEW", "IN_PROGRESS", "WON", "CLOSED"]),
});

export const QUOTE_STATUS_LABELS: Record<z.infer<typeof quoteStatusSchema>["status"], string> = {
  NEW: "Novo",
  IN_PROGRESS: "Em curso",
  WON: "Ganho",
  CLOSED: "Fechado",
};

// ---------- Team & invites ----------

export const roleSchema = z.enum(["ADMIN", "GESTOR_RH", "EDITOR", "COLABORADOR"]);

export type RoleValue = z.infer<typeof roleSchema>;

export const ROLE_LABELS: Record<RoleValue, string> = {
  ADMIN: "Administrador",
  GESTOR_RH: "Gestor de RH",
  EDITOR: "Editor",
  COLABORADOR: "Colaborador",
};

/** What each role may do, shown next to the picker so the choice is informed. */
export const ROLE_HINTS: Record<RoleValue, string> = {
  ADMIN: "Acesso total, incluindo definições, equipa e confirmação do prémio.",
  GESTOR_RH: "Vê e gere folhas, atividades e o ranking do prémio. Sem acesso às definições do site.",
  EDITOR: "Gere o catálogo, casos de estudo e orçamentos.",
  COLABORADOR: "Regista a própria atividade e vê apenas a sua pontuação.",
};

/**
 * Optional "days per week" field.
 *
 * An unfilled number input posts "", and `z.coerce.number()` turns that into 0,
 * which fails min(1) — so the empty string has to become `undefined` before
 * coercion rather than after.
 */
const diasSemanaOpcional = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce
    .number({ error: "Os dias por semana devem ser um número" })
    .int()
    .min(1, "Mínimo 1 dia por semana")
    .max(7, "Máximo 7 dias por semana")
    .optional(),
);

export const inviteSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Indique o nome (mín. 2 caracteres)")
      .max(120, "Nome demasiado longo (máx. 120 caracteres)"),
    email: z.email("Email inválido").max(200).transform((value) => value.toLowerCase()),
    role: roleSchema.default("EDITOR"),
    // Employee record, captured up front so the ficha is complete on day one.
    cargoId: z.string().optional().or(z.literal("")),
    departamentoId: z.string().optional().or(z.literal("")),
    dataAdmissao: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)")
      .optional()
      .or(z.literal("")),
    diasSemana: diasSemanaOpcional,
  })
  // An employee with no cargo is invisible to the award: the ranking only
  // considers accounts that have one, so letting this through would create
  // someone who logs activity for a prize they can never place in.
  .refine((v) => v.role !== "COLABORADOR" || Boolean(v.cargoId), {
    message: "Escolha o cargo — sem cargo o colaborador não entra no ranking do prémio.",
    path: ["cargoId"],
  });

export const inviteIdSchema = z.object({ id: z.string().min(1) });

export const userRoleSchema = z.object({
  id: z.string().min(1),
  role: roleSchema,
});

export const userActiveSchema = z.object({
  id: z.string().min(1),
  active: z.stringbool(),
});

/**
 * Password rules. The minimum is a parameter because the two kinds of password
 * are not the same credential: one is kept, the other is read out loud once and
 * dies at the next login.
 */
const passwordField = (min: number) =>
  z
    .string()
    .min(min, `A password deve ter pelo menos ${min} caracteres`)
    .max(200, "Password demasiado longa")
    .refine((value) => /[a-zA-Z]/.test(value), "A password deve incluir pelo menos uma letra")
    .refine((value) => /\d/.test(value), "A password deve incluir pelo menos um número");

/** A password its owner will keep. */
const senhaDefinitiva = passwordField(10);

/** A throwaway an admin hands over; replaced on the next login. */
const senhaTemporaria = passwordField(8);

export const acceptInviteSchema = z
  .object({
    token: z.string().min(1),
    password: senhaDefinitiva,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As passwords não coincidem",
    path: ["confirmPassword"],
  });

/**
 * An admin setting a temporary password for someone who lost theirs.
 *
 * Deliberately without a confirmation field: the admin is typing a throwaway
 * they are about to read out, and the person who has to live with a typo is the
 * one who will be forced to replace it on the next screen anyway. The strength
 * rules still apply — a temporary password is a real credential for as long as
 * it exists.
 */
export const resetUserPasswordSchema = z.object({
  id: z.string().min(1),
  password: senhaTemporaria,
});

/** Someone replacing the temporary password an admin gave them. */
export const changeOwnPasswordSchema = z
  .object({
    password: senhaDefinitiva,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As passwords não coincidem",
    path: ["confirmPassword"],
  });

// ---------- Site settings ----------

/** Optional free text: "" is kept as "" so the loader can fall back to default. */
const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} demasiado longo (máx. ${max} caracteres)`).optional().or(z.literal(""));

/** Accepts a site-relative path (/uploads/…) or an absolute http(s) URL. */
const assetPath = (label: string) =>
  z
    .string()
    .trim()
    .max(500, `${label} demasiado longo (máx. 500 caracteres)`)
    .refine(
      (value) => value === "" || value.startsWith("/") || /^https?:\/\//.test(value),
      `${label} deve ser um caminho (/…) ou um endereço http(s)`,
    )
    .optional()
    .or(z.literal(""));

const socialUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(300, `${label} demasiado longo (máx. 300 caracteres)`)
    .refine(
      (value) => value === "" || /^https?:\/\//.test(value),
      `${label} deve começar por http:// ou https://`,
    )
    .optional()
    .or(z.literal(""));

export const siteSettingsSchema = z.object({
  // Hero
  heroEyebrow: optionalText(160, "O texto de destaque"),
  heroHeadline: optionalText(120, "O título"),
  heroHighlight: optionalText(60, "O realce do título"),
  heroSubtitle: optionalText(400, "O subtítulo"),
  heroScrollHint: optionalText(60, "A dica de scroll"),

  // Brand
  logoUrl: assetPath("O endereço do logótipo"),
  faviconUrl: assetPath("O endereço do favicon"),
  themeColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hexadecimal (ex.: #114F8C)")
    .optional()
    .or(z.literal("")),

  // Footer
  footerTagline: optionalText(400, "A descrição do rodapé"),
  footerNif: optionalText(80, "O NIF"),
  footerAddress: optionalText(300, "A morada"),
  /** One phone number per line. */
  footerPhonesText: optionalText(300, "Os telefones"),
  footerEmail: z.email("Email inválido").max(200).optional().or(z.literal("")),
  footerCopyright: optionalText(300, "O aviso de direitos"),

  // SEO
  seoTitle: optionalText(200, "O título SEO"),
  seoDescription: optionalText(400, "A descrição SEO"),
  ogImageUrl: assetPath("O endereço da imagem Open Graph"),

  // Social
  facebookUrl: socialUrl("O endereço do Facebook"),
  instagramUrl: socialUrl("O endereço do Instagram"),
  linkedinUrl: socialUrl("O endereço do LinkedIn"),
  whatsappUrl: socialUrl("O endereço do WhatsApp"),
});

/** Splits the textarea of phone numbers into one entry per non-empty line. */
export function parsePhonesText(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
}

// ---------- Catalog query params ----------

export const catalogQuerySchema = z.object({
  category: z.string().trim().max(100).optional(),
  q: z.string().trim().max(200).optional(),
  sort: z.enum(["recent", "name", "power"]).default("recent"),
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

/** Parses "Grupo | Etiqueta | Valor" lines into spec rows. */
export function parseSpecsText(text: string | undefined): { group: string; label: string; value: string }[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [group = "", label = "", value = ""] = line.split("|").map((part) => part.trim());
      return { group, label, value };
    })
    .filter((spec) => spec.group && spec.label && spec.value);
}

/** Parses "Etiqueta | Valor" lines into stat rows. */
export function parseStatsText(text: string | undefined): { label: string; value: string }[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label = "", value = ""] = line.split("|").map((part) => part.trim());
      return { label, value };
    })
    .filter((stat) => stat.label && stat.value);
}

export type FormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

/** FormState plus the invite link, surfaced when the email could not be sent. */
export type InviteFormState = FormState & { inviteUrl?: string };

export const initialFormState: FormState = { ok: false };

// ---------- Prémio "Funcionário do Mês" ----------

/** A month, "YYYY-MM". */
export const periodoSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Período inválido (use AAAA-MM)");

/** A year, "YYYY". */
export const anoSchema = z.string().trim().regex(/^\d{4}$/, "Ano inválido (use AAAA)");

const horaSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (use HH:MM)");

const diaSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use AAAA-MM-DD)");

export const atividadeSchema = z
  .object({
    id: z.string().optional(),
    categoriaId: z.string().min(1, "Escolha uma categoria"),
    descricao: z
      .string()
      .trim()
      .min(5, "Descreva a atividade (mín. 5 caracteres)")
      .max(500, "Descrição demasiado longa (máx. 500 caracteres)"),
    dia: diaSchema,
    inicio: horaSchema,
    fim: horaSchema,
  })
  .refine((v) => v.fim > v.inicio, {
    message: "A hora de fim tem de ser posterior à de início",
    path: ["fim"],
  });

export const ACOES_REVISAO = ["validar", "questionar", "rejeitar", "reabrir"] as const;

export const revisaoAtividadeSchema = z
  .object({
    id: z.string().min(1),
    acao: z.enum(ACOES_REVISAO),
    nota: z.string().trim().max(500, "Nota demasiado longa (máx. 500 caracteres)").optional(),
  })
  .refine((v) => v.acao !== "rejeitar" || (v.nota?.length ?? 0) >= 5, {
    message: "Explique porque está a rejeitar (mín. 5 caracteres)",
    path: ["nota"],
  })
  .refine((v) => v.acao !== "questionar" || (v.nota?.length ?? 0) >= 5, {
    message: "Explique o que precisa de ser justificado (mín. 5 caracteres)",
    path: ["nota"],
  });

export const folhaAcaoSchema = z.object({
  folhaId: z.string().min(1),
  acao: z.enum(["submeter", "fechar", "reabrir"]),
});

export const calcularPeriodoSchema = z.object({
  periodo: periodoSchema,
  departamentoId: z.string().optional().or(z.literal("")),
});

export const confirmarVencedorSchema = z.object({
  awardPeriodId: z.string().min(1),
  vencedorId: z.string().min(1, "Escolha um vencedor"),
  notaConfirmacao: z
    .string()
    .trim()
    .max(1000, "Nota demasiado longa (máx. 1000 caracteres)")
    .optional()
    .or(z.literal("")),
  /** Required by the action when the pick is not the top-scoring employee. */
  motivoOverride: z
    .string()
    .trim()
    .max(1000, "Justificação demasiado longa (máx. 1000 caracteres)")
    .optional()
    .or(z.literal("")),
});

const pesoField = (label: string) =>
  z.coerce
    .number({ error: `${label} deve ser um número` })
    .int(`${label} deve ser um número inteiro`)
    .min(0, `${label} não pode ser negativo`)
    .max(100, `${label} não pode exceder 100`);

const penalField = (label: string) =>
  z.coerce
    .number({ error: `${label} deve ser um número` })
    .int(`${label} deve ser um número inteiro`)
    .min(0, `${label} não pode ser negativo`)
    .max(100, `${label} não pode exceder 100`);

export const awardSettingsSchema = z
  .object({
    pesoVolume: pesoField("O peso do volume"),
    pesoHoras: pesoField("O peso das horas"),
    pesoConsistencia: pesoField("O peso da consistência"),
    pesoQualidade: pesoField("O peso da qualidade"),
    pesoPontualidade: pesoField("O peso da pontualidade"),
    penalRejeitada: penalField("A penalização por atividade rejeitada"),
    penalInconsistencia: penalField("A penalização por inconsistência"),
    penalOutro: penalField('A penalização por excesso de "Outro"'),
    penalAtraso: penalField("A penalização por entrega fora do prazo"),
    tetoNormalizacaoPct: z.coerce
      .number({ error: "O teto de normalização deve ser um número" })
      .int()
      .min(100, "O teto não pode ser inferior a 100% da mediana")
      .max(400, "O teto não pode exceder 400% da mediana"),
    limiteOutroPct: z.coerce.number().int().min(1).max(100),
    minDiasAtividade: z.coerce.number().int().min(0).max(31),
    maxRejeitadas: z.coerce.number().int().min(0).max(100),
    minPorCargo: z.coerce.number().int().min(2).max(50),
    porDepartamento: z.coerce.boolean().default(false),
    excluirVencedorAnterior: z.coerce.boolean().default(false),
  })
  .refine(
    (v) =>
      v.pesoVolume +
        v.pesoHoras +
        v.pesoConsistencia +
        v.pesoQualidade +
        v.pesoPontualidade ===
      100,
    {
      message: "Os cinco pesos têm de somar exatamente 100.",
      path: ["pesoVolume"],
    },
  );

export const colaboradorSchema = z.object({
  id: z.string().min(1),
  cargoId: z.string().optional().or(z.literal("")),
  departamentoId: z.string().optional().or(z.literal("")),
  dataAdmissao: diaSchema.optional().or(z.literal("")),
  dataSaida: diaSchema.optional().or(z.literal("")),
  diasSemana: diasSemanaOpcional,
  photoUrl: z.string().trim().max(500).optional().or(z.literal("")),
});

// ---------- Estrutura da organização (cargos, departamentos, categorias) ----------

const nomeCurto = (label: string, max = 80) =>
  z
    .string()
    .trim()
    .min(2, `${label} demasiado curto (mín. 2 caracteres)`)
    .max(max, `${label} demasiado longo (máx. ${max} caracteres)`);

export const cargoSchema = z.object({
  id: z.string().optional().or(z.literal("")),
  nome: nomeCurto("O nome do cargo"),
  diasSemana: z.coerce
    .number({ error: "Os dias por semana devem ser um número" })
    .int()
    .min(1, "Mínimo 1 dia por semana")
    .max(7, "Máximo 7 dias por semana")
    .default(5),
});

export const departamentoSchema = z.object({
  id: z.string().optional().or(z.literal("")),
  nome: nomeCurto("O nome do departamento"),
});

export const categoriaAtividadeSchema = z.object({
  id: z.string().optional().or(z.literal("")),
  nome: nomeCurto("O nome da categoria"),
  /** Marks the catch-all bucket that triggers the "Outro" penalty. */
  isOutro: z.coerce.boolean().default(false),
});

export const alternarAtivoSchema = z.object({
  id: z.string().min(1),
  tipo: z.enum(["cargo", "departamento", "categoria"]),
  ativo: z.stringbool(),
});
