import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MetaPixel } from "@/app/components/MetaPixel";
import { TikTokPixel } from "@/app/components/TikTokPixel";
import { organizationJsonLd, SITE_URL } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Video2PDF: Film Any Book, Get a Searchable PDF",
  description:
    "Film any textbook, note, or handout and get a searchable, shareable PDF in seconds. Meet Bindy, your bookworm guide.",
  // Relative canonical: resolves against each route's own URL, consolidating
  // signals from the vercel.app mirror and the apex domain onto www.
  alternates: { canonical: "./" },
  icons: { icon: "/assets/icon-192.png", apple: "/assets/icon-192.png" },
  openGraph: {
    title: "Video2PDF: Film Any Book, Get a Searchable PDF",
    description:
      "Film any textbook, note, or handout and get a searchable, shareable PDF in seconds. Meet Bindy, your bookworm guide.",
    type: "website",
    siteName: "Video2PDF",
    url: SITE_URL,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <MetaPixel />
        <TikTokPixel />
        {children}
      </body>
    </html>
  );
}
