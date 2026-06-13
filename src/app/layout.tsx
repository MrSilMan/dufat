import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["500", "600", "700", "800", "900"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Dufat, Lda. — Iluminação Pública e Material Elétrico",
    template: "%s | Dufat, Lda.",
  },
  description:
    "Iluminamos o futuro das cidades de Angola: luminárias públicas LED, postes galvanizados, iluminação decorativa e material elétrico profissional.",
  openGraph: {
    type: "website",
    locale: "pt_AO",
    siteName: "Dufat, Lda.",
  },
};

export const viewport: Viewport = {
  themeColor: "#114F8C",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt" className={`${archivo.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
