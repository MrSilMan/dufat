"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { invalidateCache } from "@/lib/redis";
import { assertAdminRole, requireAdmin, requireAdminRole } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { isInvgestEnabled, invgestErrorMessage, listAllItems, precoComIva } from "@/lib/invgest";
import { SETTINGS_CACHE_KEY, SETTINGS_ID } from "@/lib/settings";
import {
  caseStudySchema,
  NEW_CATEGORY_VALUE,
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

  // "+ Nova categoria…" was chosen: create (or reuse, by slug) the category and
  // point the product at it. The schema guarantees a non-empty name here.
  let categoryId = data.categoryId;
  if (categoryId === NEW_CATEGORY_VALUE) {
    const name = (data.newCategoryName ?? "").trim();
    const slug = slugifyCategory(name);
    // New categories sort ahead of the "por-classificar" staging bucket (999).
    const maxOrder = await prisma.category.aggregate({
      _max: { sortOrder: true },
      where: { slug: { not: "por-classificar" } },
    });
    const category = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { slug, name, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
      select: { id: true },
    });
    categoryId = category.id;
  }

  const payload = {
    name: data.name,
    slug: data.slug,
    sku: data.sku || null,
    modelCode: data.modelCode || null,
    categoryId,
    shortDescription: data.shortDescription,
    description: data.description,
    heroImage: data.heroImage || null,
    priceKz: data.priceKz ?? null,
    wattage: data.wattage ?? null,
    lumens: data.lumens ?? null,
    featured: data.featured,
    published: data.published,
    has3dViewer: data.has3dViewer,
    viewer3dVariant: data.viewer3dVariant || null,
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

/** Accent-stripped, URL-safe slug for an imported product name. */
function slugifyProduct(input: string): string {
  const slug = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "produto";
}

/** Accent-stripped, URL-safe slug for a new category name. */
function slugifyCategory(input: string): string {
  const slug = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "categoria";
}

/** A product slug that doesn't collide with an existing one. */
async function uniqueProductSlug(name: string, fallback: string): Promise<string> {
  const base = slugifyProduct(name);
  const candidates = [base, `${base}-${slugifyProduct(fallback)}`];
  for (const candidate of candidates) {
    const taken = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  for (let n = 2; n <= 1000; n++) {
    const candidate = `${base}-${n}`;
    const taken = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Import the INVGEST catalog into local products. INVGEST is the source of which
 * products exist and their billing data (name + price, stored with IVA as the
 * site quotes it); the rich showcase fields
 * (category, images, specs, wattage/lumens, 3D) are enriched locally afterwards.
 *
 * Matched by invgestItemId: an existing link has its name/price refreshed; an
 * unknown item becomes a new product in the "Por classificar" category, left
 * UNPUBLISHED so bare imports never reach the public site before enrichment.
 * Products not in INVGEST are left untouched. ADMIN-only.
 */
export async function importProductsFromInvgest(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdminRole();

  if (!isInvgestEnabled()) {
    return { ok: false, message: "A integração INVGEST não está configurada." };
  }

  // Optional subset controls: an INVGEST-side text filter and a hard cap on how
  // many items to bring in. An empty "max" imports the whole catalog.
  const search = String(formData.get("search") ?? "").trim().slice(0, 200) || undefined;
  const maxRaw = Number(formData.get("max"));
  const maxItems = Number.isFinite(maxRaw) && maxRaw >= 1 ? Math.min(Math.floor(maxRaw), 5000) : undefined;

  try {
    const items = await listAllItems({ search, maxItems });
    if (items.length === 0) {
      return {
        ok: true,
        message: search
          ? `Sem artigos na INVGEST para o filtro “${search}”.`
          : "O catálogo INVGEST está vazio — nada a importar.",
      };
    }

    // Landing category for freshly imported products; re-classified in the admin.
    const category = await prisma.category.upsert({
      where: { slug: "por-classificar" },
      update: {},
      create: { slug: "por-classificar", name: "Por classificar", sortOrder: 999 },
    });

    let created = 0;
    let updated = 0;
    const now = new Date();

    for (const item of items) {
      const existing = await prisma.product.findFirst({
        where: { invgestItemId: item.id },
        select: { id: true },
      });

      // INVGEST prices are net; the site quotes what a customer pays, so the
      // article's IVA goes on before the price is stored. Items with a 0 price
      // mean "no price defined" — those stay null locally, so the site shows
      // "Preço sob consulta" instead of 0,00 Kz.
      const priceKz = item.unitPrice > 0 ? precoComIva(item.unitPrice, item.taxRate) : null;

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: item.description,
            priceKz,
            invgestItemCode: item.code ?? null,
            invgestSyncedAt: now,
          },
        });
        updated++;
      } else {
        await prisma.product.create({
          data: {
            slug: await uniqueProductSlug(item.description, item.code ?? item.id),
            name: item.description,
            shortDescription: item.description,
            description: item.description,
            categoryId: category.id,
            priceKz,
            published: false,
            invgestItemId: item.id,
            invgestItemCode: item.code ?? null,
            invgestSyncedAt: now,
          },
        });
        created++;
      }
    }

    await invalidateCatalog();
    revalidatePath("/admin/products");

    await recordAudit(admin, {
      action: "product.invgest_imported",
      entity: "Product",
      summary: `Importou da INVGEST: ${created} criado(s), ${updated} atualizado(s)${search ? ` (filtro “${search}”)` : ""}.`,
      meta: { created, updated, total: items.length, search: search ?? null, maxItems: maxItems ?? null },
    });
    logger.info("admin_products_invgest_imported", {
      created,
      updated,
      total: items.length,
      search,
      maxItems,
      by: admin.email,
    });

    return {
      ok: true,
      message:
        `Importação concluída: ${created} criado(s), ${updated} atualizado(s).` +
        (created > 0 ? " Os novos produtos ficam por publicar até serem completados." : ""),
    };
  } catch (error) {
    logger.error("admin_products_invgest_import_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: invgestErrorMessage(error) };
  }
}

/**
 * Remove the LOCAL link between a product and its INVGEST item. This does NOT
 * delete anything in INVGEST — items cannot be deleted via the API — it only
 * clears the stored id/code so the product can be synced again (which would
 * create a fresh INVGEST item). ADMIN-only.
 */
export async function unsyncProductFromInvgest(formData: FormData): Promise<void> {
  const admin = await requireAdminRole();
  const id = (formData.get("id") as string) || "";
  if (!id) return;

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, name: true, invgestItemId: true, invgestItemCode: true },
  });
  if (!product || !product.invgestItemId) return;

  await prisma.product.update({
    where: { id: product.id },
    data: { invgestItemId: null, invgestItemCode: null, invgestSyncedAt: null },
  });

  await recordAudit(admin, {
    action: "product.invgest_unlinked",
    entity: "Product",
    entityId: product.id,
    summary: `Desassociou “${product.name}” da INVGEST (o artigo ${product.invgestItemCode ?? product.invgestItemId} permanece na INVGEST).`,
    meta: { invgestItemId: product.invgestItemId, invgestItemCode: product.invgestItemCode },
  });
  logger.info("admin_product_invgest_unlinked", { id: product.id, by: admin.email });

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${product.id}/edit`);
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
