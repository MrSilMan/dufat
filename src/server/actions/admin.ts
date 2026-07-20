"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { invalidateCache } from "@/lib/redis";
import { assertAdminRole, requireAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { SETTINGS_CACHE_KEY, SETTINGS_ID } from "@/lib/settings";
import {
  caseStudySchema,
  parsePhonesText,
  parseSpecsText,
  parseStatsText,
  productSchema,
  QUOTE_STATUS_LABELS,
  quoteStatusSchema,
  siteSettingsSchema,
  type FormState,
} from "@/lib/validation";

function validationError(error: z.ZodError): FormState {
  return {
    ok: false,
    message: "Verifique os campos assinalados.",
    errors: z.flattenError(error).fieldErrors as Record<string, string[]>,
  };
}

const uniqueFieldLabels: Record<string, string> = {
  slug: "Já existe um registo com este slug.",
  sku: "Já existe um produto com este SKU.",
};

/**
 * Maps a Prisma unique-constraint violation (P2002) onto the offending field so
 * the form can highlight it, instead of blaming every unique column at once.
 */
function uniqueConstraintError(error: unknown, fallback: string): FormState | null {
  if (typeof error !== "object" || error === null) return null;
  const { code, meta } = error as { code?: string; meta?: { target?: unknown } };
  if (code !== "P2002") return null;

  const target = Array.isArray(meta?.target)
    ? meta.target.filter((value): value is string => typeof value === "string")
    : [];
  const field = target.find((name) => name in uniqueFieldLabels);
  if (!field) return { ok: false, message: fallback };

  return {
    ok: false,
    message: uniqueFieldLabels[field],
    errors: { [field]: [uniqueFieldLabels[field]] },
  };
}

async function invalidateCatalog() {
  await invalidateCache("catalog:");
  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/solutions");
}

function readCheckbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

// ---------- Products ----------

export async function saveProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.featured = readCheckbox(formData, "featured");
  raw.published = readCheckbox(formData, "published");
  raw.has3dViewer = readCheckbox(formData, "has3dViewer");
  for (const key of ["priceKz", "wattage", "lumens"]) {
    if (raw[key] === "") delete raw[key];
  }

  const result = productSchema.safeParse(raw);
  if (!result.success) return validationError(result.error);

  const id = (formData.get("id") as string) || null;
  const { specsText, ...data } = result.data;
  const specs = parseSpecsText(specsText);

  const payload = {
    name: data.name,
    slug: data.slug,
    sku: data.sku || null,
    modelCode: data.modelCode || null,
    categoryId: data.categoryId,
    shortDescription: data.shortDescription,
    description: data.description,
    heroImage: data.heroImage || null,
    priceKz: data.priceKz ?? null,
    wattage: data.wattage ?? null,
    lumens: data.lumens ?? null,
    featured: data.featured,
    published: data.published,
    has3dViewer: data.has3dViewer,
  };

  try {
    const product = id
      ? await prisma.product.update({ where: { id }, data: payload })
      : await prisma.product.create({ data: payload });

    await prisma.spec.deleteMany({ where: { productId: product.id } });
    if (specs.length > 0) {
      await prisma.spec.createMany({
        data: specs.map((spec, index) => ({ ...spec, productId: product.id, sortOrder: index })),
      });
    }

    await invalidateCatalog();
    revalidatePath(`/products/${product.slug}`);
    await recordAudit(admin, {
      action: id ? "product.updated" : "product.created",
      entity: "Product",
      entityId: product.id,
      summary: `${id ? "Editou" : "Criou"} o produto “${product.name}”`,
      meta: { slug: product.slug, published: product.published },
    });
    logger.info("admin_product_saved", { id: product.id, slug: product.slug, by: admin.email });
  } catch (error) {
    logger.error("admin_product_save_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return (
      uniqueConstraintError(error, "Erro ao guardar. O slug/SKU pode já existir.") ?? {
        ok: false,
        message: "Erro ao guardar o produto. Tente novamente.",
      }
    );
  }
  redirect("/admin/products");
}

/** Admin-only: deletion is irreversible and cascades to the product's specs. */
export async function deleteProduct(formData: FormData): Promise<void> {
  const admin = await assertAdminRole();
  const id = formData.get("id") as string;
  if (!id) return;

  const product = await prisma.product.findUnique({ where: { id }, select: { name: true } });
  await prisma.product.delete({ where: { id } });
  await invalidateCatalog();
  await recordAudit(admin, {
    action: "product.deleted",
    entity: "Product",
    entityId: id,
    summary: `Apagou o produto “${product?.name ?? id}”`,
  });
  logger.info("admin_product_deleted", { id, by: admin.email });
  revalidatePath("/admin/products");
}

// ---------- Case studies ----------

export async function saveCaseStudy(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const raw = Object.fromEntries(formData) as Record<string, unknown>;
  raw.published = readCheckbox(formData, "published");

  const result = caseStudySchema.safeParse(raw);
  if (!result.success) return validationError(result.error);

  const id = (formData.get("id") as string) || null;
  const { statsText, ...data } = result.data;

  const payload = {
    title: data.title,
    slug: data.slug,
    client: data.client,
    location: data.location,
    summary: data.summary,
    body: data.body,
    heroImage: data.heroImage || null,
    stats: parseStatsText(statsText),
    published: data.published,
    sortOrder: data.sortOrder,
  };

  try {
    const study = id
      ? await prisma.caseStudy.update({ where: { id }, data: payload })
      : await prisma.caseStudy.create({ data: payload });
    await invalidateCatalog();
    await recordAudit(admin, {
      action: id ? "case_study.updated" : "case_study.created",
      entity: "CaseStudy",
      entityId: study.id,
      summary: `${id ? "Editou" : "Criou"} o caso de estudo “${study.title}”`,
      meta: { slug: study.slug, published: study.published },
    });
    logger.info("admin_case_study_saved", { id: study.id, slug: study.slug, by: admin.email });
  } catch (error) {
    logger.error("admin_case_study_save_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return (
      uniqueConstraintError(error, "Erro ao guardar. O slug pode já existir.") ?? {
        ok: false,
        message: "Erro ao guardar o caso de estudo. Tente novamente.",
      }
    );
  }
  redirect("/admin/case-studies");
}

/** Admin-only: deletion is irreversible. */
export async function deleteCaseStudy(formData: FormData): Promise<void> {
  const admin = await assertAdminRole();
  const id = formData.get("id") as string;
  if (!id) return;

  const study = await prisma.caseStudy.findUnique({ where: { id }, select: { title: true } });
  await prisma.caseStudy.delete({ where: { id } });
  await invalidateCatalog();
  await recordAudit(admin, {
    action: "case_study.deleted",
    entity: "CaseStudy",
    entityId: id,
    summary: `Apagou o caso de estudo “${study?.title ?? id}”`,
  });
  logger.info("admin_case_study_deleted", { id, by: admin.email });
  revalidatePath("/admin/case-studies");
}

// ---------- Site settings ----------

export async function saveSiteSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  const result = siteSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return validationError(result.error);

  const { footerPhonesText, ...data } = result.data;
  const isAdmin = admin.role === "ADMIN";

  // "" means "unset" — store NULL so the loader serves the shipped default
  // instead of rendering a blank heading.
  const blankToNull = (value: string | undefined) => (value?.trim() ? value.trim() : null);
  const payload = {
    heroEyebrow: blankToNull(data.heroEyebrow),
    heroHeadline: blankToNull(data.heroHeadline),
    // The highlight is the one field where "" is meaningful (no gradient tail),
    // so it is stored verbatim rather than collapsed to NULL.
    heroHighlight: data.heroHighlight ?? null,
    heroSubtitle: blankToNull(data.heroSubtitle),
    heroScrollHint: blankToNull(data.heroScrollHint),

    footerTagline: blankToNull(data.footerTagline),
    footerNif: blankToNull(data.footerNif),
    footerAddress: blankToNull(data.footerAddress),
    footerPhones: parsePhonesText(footerPhonesText),
    footerEmail: blankToNull(data.footerEmail),
    footerCopyright: blankToNull(data.footerCopyright),

    seoTitle: blankToNull(data.seoTitle),
    seoDescription: blankToNull(data.seoDescription),
    ogImageUrl: blankToNull(data.ogImageUrl),

    facebookUrl: blankToNull(data.facebookUrl),
    instagramUrl: blankToNull(data.instagramUrl),
    linkedinUrl: blankToNull(data.linkedinUrl),
    whatsappUrl: blankToNull(data.whatsappUrl),

    // Brand identity is admin-only. Editors never receive these inputs, but the
    // check lives here because a hand-crafted POST would otherwise reach the
    // database — the rendered form is not a security boundary.
    ...(isAdmin
      ? {
          logoUrl: blankToNull(data.logoUrl),
          faviconUrl: blankToNull(data.faviconUrl),
          themeColor: blankToNull(data.themeColor),
        }
      : {}),
  };

  try {
    await prisma.siteSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, ...payload },
      update: payload,
    });
    await invalidateSettings();
    await recordAudit(admin, {
      action: "settings.updated",
      entity: "SiteSettings",
      entityId: SETTINGS_ID,
      summary: isAdmin
        ? "Alterou as definições do site"
        : "Alterou as definições do site (conteúdo)",
      meta: { branding: isAdmin },
    });
    logger.info("admin_site_settings_saved", { by: admin.email, role: admin.role });
  } catch (error) {
    logger.error("admin_site_settings_save_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "Erro ao guardar as definições. Tente novamente." };
  }
  return { ok: true, message: "Definições guardadas." };
}

/**
 * Settings feed the root layout (metadata, favicon) and the shared
 * header/footer, so every route's cached HTML is stale after a save.
 */
async function invalidateSettings() {
  await invalidateCache(SETTINGS_CACHE_KEY);
  revalidatePath("/", "layout");
}

// ---------- Quotes ----------

export async function updateQuoteStatus(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const result = quoteStatusSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return;

  const before = await prisma.quoteRequest.findUnique({
    where: { id: result.data.id },
    select: { name: true, status: true },
  });
  await prisma.quoteRequest.update({
    where: { id: result.data.id },
    data: { status: result.data.status },
  });
  await recordAudit(admin, {
    action: "quote.status_changed",
    entity: "QuoteRequest",
    entityId: result.data.id,
    summary: `Mudou o orçamento de ${before?.name ?? result.data.id} para ${QUOTE_STATUS_LABELS[result.data.status]}`,
    meta: { from: before?.status, to: result.data.status },
  });
  logger.info("admin_quote_status_updated", {
    id: result.data.id,
    status: result.data.status,
    by: admin.email,
  });
  revalidatePath("/admin/quotes");
}
