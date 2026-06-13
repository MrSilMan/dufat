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
  .min(2)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido (use letras minúsculas, números e hífens)");

export const productSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: slugField,
  sku: z.string().trim().max(60).optional().or(z.literal("")),
  modelCode: z.string().trim().max(60).optional().or(z.literal("")),
  categoryId: z.string().min(1, "Escolha uma categoria"),
  shortDescription: z.string().trim().min(10).max(400),
  description: z.string().trim().min(10).max(8000),
  heroImage: z.string().trim().max(500).optional().or(z.literal("")),
  priceKz: z.coerce.number().min(0).max(999_999_999).optional(),
  wattage: z.coerce.number().int().min(0).max(10_000).optional(),
  lumens: z.coerce.number().int().min(0).max(1_000_000).optional(),
  featured: z.coerce.boolean().default(false),
  published: z.coerce.boolean().default(true),
  has3dViewer: z.coerce.boolean().default(false),
  /** One spec per line: "Grupo | Etiqueta | Valor" */
  specsText: z.string().max(20_000).optional().or(z.literal("")),
});

export const caseStudySchema = z.object({
  title: z.string().trim().min(2).max(200),
  slug: slugField,
  client: z.string().trim().min(2).max(200),
  location: z.string().trim().min(2).max(200),
  summary: z.string().trim().min(10).max(600),
  body: z.string().trim().min(10).max(20_000),
  heroImage: z.string().trim().max(500).optional().or(z.literal("")),
  /** One stat per line: "Etiqueta | Valor" */
  statsText: z.string().max(4000).optional().or(z.literal("")),
  published: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const quoteStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["NEW", "IN_PROGRESS", "WON", "CLOSED"]),
});

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

export const initialFormState: FormState = { ok: false };
