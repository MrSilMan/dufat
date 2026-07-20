import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { deleteCaseStudy } from "@/server/actions/admin";
import { PageHeader, PublishBadge, EmptyState, RowEditLink, rowDangerClass } from "@/components/admin/ui";
import { DangerSubmit } from "@/components/admin/DangerSubmit";
import { IconBook, IconPlus } from "@/components/admin/icons";

export const dynamic = "force-dynamic";

export default async function AdminCaseStudiesPage() {
  const session = await requireAdmin();
  const canDelete = session.role === "ADMIN";
  const studies = await prisma.caseStudy.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Casos de Estudo"
        description="Histórias de projetos executados, apresentadas na página de soluções."
        action={
          <Link href="/admin/case-studies/new" className="btn-admin">
            <IconPlus className="h-4 w-4" />
            Novo caso
          </Link>
        }
      />

      <div className="card-admin list-rows overflow-hidden">
        {studies.length === 0 && (
          <EmptyState
            icon={<IconBook className="h-5 w-5" />}
            title="Ainda sem casos de estudo"
            description="Adicione o primeiro projeto para contar a história da Dufat."
            action={
              <Link href="/admin/case-studies/new" className="btn-admin-ghost">
                <IconPlus className="h-4 w-4" />
                Novo caso
              </Link>
            }
          />
        )}
        {studies.map((study) => (
          <div
            key={study.id}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 p-5"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-a-accent-soft font-mono text-xs font-semibold text-a-on-accent-soft">
              {String(study.sortOrder).padStart(2, "0")}
            </span>
            <div className="min-w-48 flex-1">
              <p className="font-semibold text-a-text">{study.title}</p>
              <p className="mt-0.5 text-xs text-a-faint">
                {study.location} · {study.client}
              </p>
            </div>
            <PublishBadge published={study.published} />
            <div className="flex items-center gap-2">
              <RowEditLink href={`/admin/case-studies/${study.id}/edit`} />
              {canDelete && (
                <form action={deleteCaseStudy}>
                  <input type="hidden" name="id" value={study.id} />
                  <DangerSubmit
                    confirmMessage={`Apagar o caso de estudo “${study.title}”? Esta ação não pode ser desfeita.`}
                    className={rowDangerClass}
                  >
                    Apagar
                  </DangerSubmit>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
