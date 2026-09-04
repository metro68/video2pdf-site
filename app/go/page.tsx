import type { Metadata } from "next";
import { Funnel } from "./components/Funnel";
import { goOffersJsonLd } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "Start Your Free Trial | Video2PDF",
  description:
    "Try Video2PDF Pro free for 3 days, then $29.99 per year. Unlimited scans, full-resolution searchable PDFs, cancel anytime before the trial ends.",
};

export default function GoPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(goOffersJsonLd) }}
      />
      <Funnel />
    </>
  );
}
