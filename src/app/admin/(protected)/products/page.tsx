import Link from "next/link";
import { prisma } from "@/lib/db";
import { deleteProduct } from "@/server/actions/admin";
import { formatKz } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: { select: { name: true } } },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black">Produtos</h1>
        <Link
          href="/admin/products/new"
          className="rounded-full bg-dufat px-5 py-2.5 text-sm font-semibold text-white hover:bg-dufat-bright"
        >
          + Novo produto
        </Link>
      </div>

      <div className="card-night mt-8 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead>
            <tr className="border-b border-night-line text-left text-xs uppercase tracking-wider text-white/50">
              <th className="px-5 py-3 font-semibold">Nome</th>
              <th className="px-5 py-3 font-semibold">Categoria</th>
              <th className="px-5 py-3 font-semibold">Preço</th>
              <th className="px-5 py-3 font-semibold">Estado</th>
              <th className="px-5 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-night-line">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-5 py-3">
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-xs text-white/45">{product.slug}</p>
                </td>
                <td className="px-5 py-3 text-white/65">{product.category.name}</td>
                <td className="px-5 py-3 text-white/65">
                  {product.priceKz ? formatKz(product.priceKz.toString()) : "Sob consulta"}
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs ${
                      product.published
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-white/10 text-white/50"
                    }`}
                  >
                    {product.published ? "Publicado" : "Rascunho"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="text-dufat-sky hover:underline"
                    >
                      Editar
                    </Link>
                    <form action={deleteProduct}>
                      <input type="hidden" name="id" value={product.id} />
                      <button type="submit" className="text-red-400/80 hover:underline">
                        Apagar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
