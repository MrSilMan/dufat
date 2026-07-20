import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { CaseStudyForm } from "@/components/admin/CaseStudyForm";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

type Stat = { label: string; value: string };

export default async function EditCaseStudyPage({ params }: Props) {
  const { id } = await params;
  const study = await prisma.caseStudy.findUnique({ where: { id } });
  if (!study) notFound();

  const stats = Array.isArray(study.stats) ? (study.stats as Stat[]) : [];
  const statsText = stats.map((stat) => `${stat.label} | ${stat.value}`).join("\n");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Editar caso de estudo"
        description={study.title}
        backHref="/admin/case-studies"
        backLabel="Casos de Estudo"
      />
      <CaseStudyForm
        study={{
          id: study.id,
          title: study.title,
          slug: study.slug,
          client: study.client,
          location: study.location,
          summary: study.summary,
          body: study.body,
          heroImage: study.heroImage,
          statsText,
          published: study.published,
          sortOrder: study.sortOrder,
        }}
      />
    </div>
  );
}
