import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = ["", "/products", "/solutions", "/about", "/contact"].map(
    (path) => ({
      url: `${siteUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: path === "" ? 1 : 0.7,
    }),
  );

  try {
    const products = await prisma.product.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    });
    const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
      url: `${siteUrl}/products/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "monthly",
      priority: 0.8,
    }));
    return [...staticRoutes, ...productRoutes];
  } catch {
    // Database unavailable (e.g. build time) — static routes still ship.
    return staticRoutes;
  }
}
