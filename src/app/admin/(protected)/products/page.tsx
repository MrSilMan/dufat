import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { deleteProduct } from "@/server/actions/admin";
import { formatKz } from "@/lib/format";
import { PageHeader, PublishBadge, EmptyState, RowEditLink, rowDangerClass } from "@/components/admin/ui";
import { DangerSubmit } from "@/components/admin/DangerSubmit";
import { IconBox, IconPlus } from "@/components/admin/icons";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const session = await requireAdmin();
  const canDelete = session.role === "ADMIN";
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: { category: { select: { name: true } } },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Produtos"
        description="Catálogo de luminárias, postes e material elétrico publicado no site."
        action={
          <Link href="/admin/products/new" className="btn-admin">
            <IconPlus className="h-4 w-4" />
            Novo produto
          </Link>
        }
      />

      <div className="card-admin overflow-hidden">
        {products.length === 0 ? (
          <EmptyState
            icon={<IconBox className="h-5 w-5" />}
            title="Ainda sem produtos"
            description="Crie o primeiro produto para o catálogo do site."
            action={
              <Link href="/admin/products/new" className="btn-admin-ghost">
                <IconPlus className="h-4 w-4" />
                Novo produto
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-3xl text-sm">
              <thead>
                <tr className="border-b border-a-line text-left text-xs uppercase tracking-wider text-a-faint">
                  <th className="px-5 py-3.5 font-semibold">Produto</th>
                  <th className="px-5 py-3.5 font-semibold">Categoria</th>
                  <th className="px-5 py-3.5 font-semibold">Preço</th>
                  <th className="px-5 py-3.5 font-semibold">Estado</th>
                  <th className="px-5 py-3.5 font-semibold">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="table-rows">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3.5">
                        {product.heroImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.heroImage}
                            alt=""
                            className="h-11 w-14 shrink-0 rounded-lg border border-a-line object-cover"
                          />
                        ) : (
                          <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-a-line-strong text-a-faint">
                            <IconBox className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-a-text">{product.name}</p>
                          <p className="font-mono text-xs text-a-faint">{product.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-a-muted">{product.category.name}</td>
                    <td className="px-5 py-3.5 font-mono text-xs text-a-muted">
                      {product.priceKz ? formatKz(product.priceKz.toString()) : "Sob consulta"}
                    </td>
                    <td className="px-5 py-3.5">
                      <PublishBadge published={product.published} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <RowEditLink href={`/admin/products/${product.id}/edit`} />
                        {canDelete && (
                          <form action={deleteProduct}>
                            <input type="hidden" name="id" value={product.id} />
                            <DangerSubmit
                              confirmMessage={`Apagar o produto “${product.name}”? Esta ação não pode ser desfeita.`}
                              className={rowDangerClass}
                            >
                              Apagar
                            </DangerSubmit>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
