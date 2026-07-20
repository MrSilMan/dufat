import { z } from "zod";

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
  /** One spec per line: "Grupo | Etiqueta | Valor" */
  specsText: z
    .string()
    .max(20_000, "Especificações demasiado longas (máx. 20000 caracteres)")
    .optional()
    .or(z.literal("")),
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

export const roleSchema = z.enum(["ADMIN", "EDITOR"]);

export const ROLE_LABELS: Record<z.infer<typeof roleSchema>, string> = {
  ADMIN: "Administrador",
  EDITOR: "Editor",
};

export const inviteSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Indique o nome (mín. 2 caracteres)")
    .max(120, "Nome demasiado longo (máx. 120 caracteres)"),
  email: z.email("Email inválido").max(200).transform((value) => value.toLowerCase()),
  role: roleSchema.default("EDITOR"),
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

/** Password rules for accepting an invite. */
const passwordField = z
  .string()
  .min(10, "A password deve ter pelo menos 10 caracteres")
  .max(200, "Password demasiado longa")
  .refine((value) => /[a-zA-Z]/.test(value), "A password deve incluir pelo menos uma letra")
  .refine((value) => /\d/.test(value), "A password deve incluir pelo menos um número");

export const acceptInviteSchema = z
  .object({
    token: z.string().min(1),
    password: passwordField,
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
