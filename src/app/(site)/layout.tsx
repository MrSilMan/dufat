import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { TrackPageView } from "@/components/layout/TrackPageView";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
      <TrackPageView />
    </>
  );
}
