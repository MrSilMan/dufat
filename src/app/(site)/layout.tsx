import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { TrackPageView } from "@/components/layout/TrackPageView";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";
import { getSiteSettings } from "@/lib/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();

  return (
    <>
      <Header logoUrl={settings.logoUrl} />
      <main>{children}</main>
      <Footer />
      <WhatsAppButton whatsappUrl={settings.whatsappUrl} />
      <TrackPageView />
    </>
  );
}
