import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireCatalogo } from "@/lib/auth";
import { isInvgestEnabled } from "@/lib/invgest";
import { ProductForm } from "@/components/admin/ProductForm";
import { InvgestOrigin } from "@/components/admin/InvgestOrigin";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const session = await requireCatalogo();
  const [product, allCategories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: { specs: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);
  if (!product) notFound();

  // "por-classificar" is the INVGEST import staging bucket, not a real catalog
  // category — offer it only when this product is still sitting in it, so unsorted
  // imports can be reclassified out but sorted products can't be filed back into it.
  const categories = allCategories
    .filter((category) => category.slug !== "por-classificar" || category.id === product.categoryId)
    .map(({ id, name }) => ({ id, name }));

  const showInvgest = session.role === "ADMIN" && isInvgestEnabled();

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
          viewer3dVariant: product.viewer3dVariant,
          specsText,
        }}
      />
      {showInvgest && (
        <section className="card-admin p-6">
          <h2 className="text-base font-semibold text-a-text">INVGEST</h2>
          <p className="mt-1 max-w-lg text-sm text-a-muted">
            {product.invgestItemId
              ? "Produto importado do catálogo INVGEST. O nome e o preço são atualizados a cada importação; os restantes campos são geridos aqui."
              : "Produto local. Importe o catálogo INVGEST a partir da lista de produtos para trazer os artigos de faturação."}
          </p>
          <div className="mt-4">
            <InvgestOrigin
              productId={product.id}
              imported={Boolean(product.invgestItemId)}
              itemCode={product.invgestItemCode}
              canDetach
              detailed
            />
          </div>
        </section>
      )}
    </div>
  );
}
