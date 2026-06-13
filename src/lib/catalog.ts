import "server-only";
import { prisma } from "@/lib/db";
import { cached } from "@/lib/redis";
import { logger } from "@/lib/logger";
import type { CatalogQuery } from "@/lib/validation";
import type { Prisma } from "@/generated/prisma/client";

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  modelCode: string | null;
  shortDescription: string;
  heroImage: string | null;
  priceKz: string | null;
  wattage: number | null;
  lumens: number | null;
  featured: boolean;
  category: { slug: string; name: string };
};

const CACHE_TTL = 60;

function toCard(product: {
  id: string;
  slug: string;
  name: string;
  modelCode: string | null;
  shortDescription: string;
  heroImage: string | null;
  priceKz: Prisma.Decimal | null;
  wattage: number | null;
  lumens: number | null;
  featured: boolean;
  category: { slug: string; name: string };
}): ProductCard {
  return {
    ...product,
    priceKz: product.priceKz ? product.priceKz.toString() : null,
    category: { slug: product.category.slug, name: product.category.name },
  };
}

const cardSelect = {
  id: true,
  slug: true,
  name: true,
  modelCode: true,
  shortDescription: true,
  heroImage: true,
  priceKz: true,
  wattage: true,
  lumens: true,
  featured: true,
  category: { select: { slug: true, name: true } },
} satisfies Prisma.ProductSelect;

/**
 * Full-text search over the product catalog (Portuguese dictionary),
 * with an ILIKE fallback for partial tokens. Returns matching ids ranked.
 */
async function searchProductIds(q: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id
    FROM "Product" p
    WHERE p.published = true
      AND (
        to_tsvector('portuguese',
          coalesce(p.name, '') || ' ' ||
          coalesce(p."modelCode", '') || ' ' ||
          coalesce(p."shortDescription", '') || ' ' ||
          coalesce(p.description, ''))
        @@ websearch_to_tsquery('portuguese', ${q})
        OR p.name ILIKE ${"%" + q + "%"}
        OR p."modelCode" ILIKE ${"%" + q + "%"}
      )
    ORDER BY ts_rank(
      to_tsvector('portuguese', coalesce(p.name, '') || ' ' || coalesce(p.description, '')),
      websearch_to_tsquery('portuguese', ${q})
    ) DESC
  `;
  return rows.map((row) => row.id);
}

export async function listProducts(query: CatalogQuery): Promise<ProductCard[]> {
  const cacheKey = `catalog:list:${query.category ?? "all"}:${query.sort}:${query.q ?? ""}`;
  return cached(cacheKey, CACHE_TTL, async () => {
    const where: Prisma.ProductWhereInput = { published: true };
    if (query.category) where.category = { slug: query.category };

    if (query.q) {
      try {
        const ids = await searchProductIds(query.q);
        where.id = { in: ids };
      } catch (error) {
        logger.warn("catalog_fts_failed_falling_back_to_ilike", {
          message: error instanceof Error ? error.message : String(error),
        });
        where.OR = [
          { name: { contains: query.q, mode: "insensitive" } },
          { modelCode: { contains: query.q, mode: "insensitive" } },
          { shortDescription: { contains: query.q, mode: "insensitive" } },
        ];
      }
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sort === "name"
        ? [{ name: "asc" }]
        : query.sort === "power"
          ? [{ wattage: { sort: "desc", nulls: "last" } }, { name: "asc" }]
          : [{ featured: "desc" }, { createdAt: "desc" }];

    const products = await prisma.product.findMany({ where, orderBy, select: cardSelect });
    return products.map(toCard);
  });
}

export async function listCategories() {
  return cached("catalog:categories", CACHE_TTL * 5, async () => {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        _count: { select: { products: { where: { published: true } } } },
      },
    });
    return categories.map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      productCount: category._count.products,
    }));
  });
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: { select: { slug: true, name: true } },
      specs: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!product || !product.published) return null;
  return {
    ...product,
    priceKz: product.priceKz ? product.priceKz.toString() : null,
  };
}

export async function listFeaturedProducts(): Promise<ProductCard[]> {
  return cached("catalog:featured", CACHE_TTL, async () => {
    const products = await prisma.product.findMany({
      where: { published: true, featured: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: cardSelect,
    });
    return products.map(toCard);
  });
}

export async function listCaseStudies() {
  return cached("catalog:case-studies", CACHE_TTL * 5, async () => {
    return prisma.caseStudy.findMany({
      where: { published: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        client: true,
        location: true,
        summary: true,
        body: true,
        heroImage: true,
        stats: true,
      },
    });
  });
}
