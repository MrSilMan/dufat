import { prisma } from "@/lib/db";
import { ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <h1 className="text-3xl font-black">Novo produto</h1>
      <div className="mt-8">
        <ProductForm categories={categories} />
      </div>
    </div>
  );
}
