import { CaseStudyForm } from "@/components/admin/CaseStudyForm";

export default function NewCaseStudyPage() {
  return (
    <div>
      <h1 className="text-3xl font-black">Novo caso de estudo</h1>
      <div className="mt-8">
        <CaseStudyForm />
      </div>
    </div>
  );
}
