import { prisma } from "@/lib/db";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Novo produto"
        description="Preencha os dados para adicionar um produto ao catálogo."
        backHref="/admin/products"
        backLabel="Produtos"
      />
      <ProductForm categories={categories} />
    </div>
  );
}
