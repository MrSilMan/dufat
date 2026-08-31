import type { Metadata } from "next";
import { requireCatalogo } from "@/lib/auth";
import { DEFAULT_SETTINGS, getSiteSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/ui";
import { SiteSettingsForm } from "@/components/admin/SiteSettingsForm";

export const metadata: Metadata = {
  title: "Definições do site",
  robots: { index: false },
};

export default async function AdminSettingsPage() {
  const session = await requireCatalogo();
  const settings = await getSiteSettings();
  const canEditBranding = session.role === "ADMIN";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Definições do site"
        description={
          canEditBranding
            ? "Personalize o texto do herói, a marca, o rodapé e o SEO. As alterações ficam visíveis no site imediatamente."
            : "Personalize o texto do herói, o rodapé e o SEO. A marca é gerida por um administrador."
        }
      />
      <SiteSettingsForm
        settings={settings}
        defaults={DEFAULT_SETTINGS}
        canEditBranding={canEditBranding}
      />
    </div>
  );
}
