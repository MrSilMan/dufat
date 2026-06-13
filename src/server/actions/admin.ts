"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { invalidateCache } from "@/lib/redis";
import { requireAdmin } from "@/lib/auth";
import {
  caseStudySchema,
  parseSpecsText,
  parseStatsText,
  productSchema,
  quoteStatusSchema,
  type FormState,
} from "@/lib/validation";

function validationError(error: z.ZodError): FormState {
  return {
    ok: false,
    message: "Verifique os campos assinalados.",
    errors: z.flattenError(error).fieldErrors as Record<string, string[]>,
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
    logger.info("admin_product_saved", { id: product.id, slug: product.slug, by: admin.email });
  } catch (error) {
    logger.error("admin_product_save_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "Erro ao guardar. O slug/SKU pode já existir." };
  }
  redirect("/admin/products");
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) return;
  await prisma.product.delete({ where: { id } });
  await invalidateCatalog();
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
    logger.info("admin_case_study_saved", { id: study.id, slug: study.slug, by: admin.email });
  } catch (error) {
    logger.error("admin_case_study_save_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: "Erro ao guardar. O slug pode já existir." };
  }
  redirect("/admin/case-studies");
}

export async function deleteCaseStudy(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) return;
  await prisma.caseStudy.delete({ where: { id } });
  await invalidateCatalog();
  logger.info("admin_case_study_deleted", { id, by: admin.email });
  revalidatePath("/admin/case-studies");
}

// ---------- Quotes ----------

export async function updateQuoteStatus(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const result = quoteStatusSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return;
  await prisma.quoteRequest.update({
    where: { id: result.data.id },
    data: { status: result.data.status },
  });
  logger.info("admin_quote_status_updated", {
    id: result.data.id,
    status: result.data.status,
    by: admin.email,
  });
  revalidatePath("/admin/quotes");
}
