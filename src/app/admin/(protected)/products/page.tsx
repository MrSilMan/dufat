import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireCatalogo } from "@/lib/auth";
import { deleteProduct } from "@/server/actions/admin";
import { formatKz, formatDate } from "@/lib/format";
import { PageHeader, PublishBadge, EmptyState, RowEditLink, rowDangerClass } from "@/components/admin/ui";
import { DangerSubmit } from "@/components/admin/DangerSubmit";
import { IconBox, IconPlus } from "@/components/admin/icons";
import { isInvgestEnabled } from "@/lib/invgest";
import { ImportInvgestButton } from "@/components/admin/ImportInvgestButton";
import { ProductQuickView, type QuickViewProduct } from "@/components/admin/ProductQuickView";
import { ProductsToolbar } from "@/components/admin/ProductsToolbar";
import { Pagination } from "@/components/admin/Pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** First value only — repeated params (`?q=a&q=b`) would otherwise be an array. */
function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function AdminProductsPage({ searchParams }: Props) {
  const session = await requireCatalogo();
  const canDelete = session.role === "ADMIN";
  const invgestAdmin = session.role === "ADMIN" && isInvgestEnabled();

  const params = await searchParams;
  const q = one(params.q);
  const estado = ["publicado", "rascunho"].includes(one(params.estado)) ? one(params.estado) : "";
  const cat = one(params.cat);
  const requestedPage = Math.max(1, Number.parseInt(one(params.page), 10) || 1);

  const where: Prisma.ProductWhereInput = {
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { modelCode: { contains: q, mode: "insensitive" } },
        { invgestItemCode: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(estado && { published: estado === "publicado" }),
    ...(cat && { categoryId: cat }),
  };

  const [total, catalogTotal, categories] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.count(),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamp so a stale ?page= (after filtering) still lands on a real page.
  const page = Math.min(requestedPage, pageCount);

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      category: { select: { name: true } },
      specs: { orderBy: { sortOrder: "asc" }, select: { group: true, label: true, value: true } },
    },
  });

  const quickView = (product: (typeof products)[number]): QuickViewProduct => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    modelCode: product.modelCode,
    categoryName: product.category.name,
    shortDescription: product.shortDescription,
    heroImage: product.heroImage,
    price: product.priceKz ? formatKz(product.priceKz.toString()) : "Sob consulta",
    wattage: product.wattage,
    lumens: product.lumens,
    featured: product.featured,
    published: product.published,
    has3dViewer: product.has3dViewer,
    invgestItemCode: product.invgestItemCode,
    imported: Boolean(product.invgestItemId),
    createdAt: formatDate(product.createdAt),
    updatedAt: formatDate(product.updatedAt),
    specs: product.specs,
  });

  const carriedParams = Object.fromEntries(
    Object.entries({ q, estado, cat }).filter(([, value]) => value),
  ) as Record<string, string>;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Produtos"
        description="Catálogo de luminárias, postes e material elétrico publicado no site."
        action={
          <div className="flex flex-wrap items-center justify-end gap-3">
            {invgestAdmin && <ImportInvgestButton />}
            <Link href="/admin/products/new" className="btn-admin">
              <IconPlus className="h-4 w-4" />
              Novo produto
            </Link>
          </div>
        }
      />

      <div className="card-admin overflow-hidden">
        {catalogTotal === 0 ? (
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
          <>
            <ProductsToolbar categories={categories} />

            {products.length === 0 ? (
              <EmptyState
                icon={<IconBox className="h-5 w-5" />}
                title="Nenhum produto corresponde aos filtros"
                description="Tente outro termo de pesquisa ou limpe os filtros."
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
                      <th className="px-5 py-3.5 font-semibold">Origem</th>
                      <th className="px-5 py-3.5 font-semibold">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="table-rows">
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td className="px-4 py-2.5">
                          <ProductQuickView product={quickView(product)} canDetach={invgestAdmin} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-a-muted">{product.category.name}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-a-muted">
                          {product.priceKz ? formatKz(product.priceKz.toString()) : "Sob consulta"}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5">
                          <PublishBadge published={product.published} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5">
                          {product.invgestItemId ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                              <span aria-hidden>✓</span>
                              INVGEST
                              {product.invgestItemCode && (
                                <span className="font-mono text-[0.7rem]">{product.invgestItemCode}</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-sm text-a-faint">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5">
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

            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              from={(page - 1) * PAGE_SIZE + 1}
              to={Math.min(page * PAGE_SIZE, total)}
              params={carriedParams}
              noun="produtos"
            />
          </>
        )}
      </div>
    </div>
  );
}
