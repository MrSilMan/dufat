import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Outfit } from "next/font/google";
import { themeInitScript } from "@/components/admin/ThemeToggle";
import { getSiteSettings } from "@/lib/settings";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["500", "600", "700", "800", "900"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "600"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** "Dufat, Lda. — Iluminação…" → "Dufat, Lda.", used for the title template. */
function brandName(seoTitle: string): string {
  return seoTitle.split("—")[0]!.trim() || seoTitle;
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const brand = brandName(settings.seoTitle);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: settings.seoTitle,
      template: `%s | ${brand}`,
    },
    description: settings.seoDescription,
    // Only override the file-based conventions when the admin uploaded assets;
    // otherwise Next keeps serving opengraph-image.tsx and the default icon.
    ...(settings.faviconUrl ? { icons: { icon: settings.faviconUrl } } : {}),
    openGraph: {
      type: "website",
      locale: "pt_AO",
      siteName: brand,
      ...(settings.ogImageUrl ? { images: [{ url: settings.ogImageUrl }] } : {}),
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const settings = await getSiteSettings();
  return { themeColor: settings.themeColor };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt"
      className={`${outfit.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Stamps the saved admin theme before paint so the admin shell never
            flashes the default theme. Must stay in <head> to beat first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
