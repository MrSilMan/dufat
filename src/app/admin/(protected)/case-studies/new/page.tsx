import { CaseStudyForm } from "@/components/admin/CaseStudyForm";
import { PageHeader } from "@/components/admin/ui";

export default function NewCaseStudyPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Novo caso de estudo"
        description="Documente um projeto executado para o apresentar no site."
        backHref="/admin/case-studies"
        backLabel="Casos de Estudo"
      />
      <CaseStudyForm />
    </div>
  );
}
