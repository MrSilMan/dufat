import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { specs: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!product) notFound();

  const specsText = product.specs
    .map((spec) => `${spec.group} | ${spec.label} | ${spec.value}`)
    .join("\n");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Editar produto"
        description={product.name}
        backHref="/admin/products"
        backLabel="Produtos"
      />
      <ProductForm
        categories={categories}
        product={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          sku: product.sku,
          modelCode: product.modelCode,
          categoryId: product.categoryId,
          shortDescription: product.shortDescription,
          description: product.description,
          heroImage: product.heroImage,
          priceKz: product.priceKz ? product.priceKz.toString() : null,
          wattage: product.wattage,
          lumens: product.lumens,
          featured: product.featured,
          published: product.published,
          has3dViewer: product.has3dViewer,
          specsText,
        }}
      />
    </div>
  );
}
