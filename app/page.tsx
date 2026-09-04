import { Nav } from "./components/landing/Nav";
import { Hero } from "./components/landing/Hero";
import { HowItWorks } from "./components/landing/HowItWorks";
import { Features } from "./components/landing/Features";
import { BindySection } from "./components/landing/BindySection";
import { SocialProof } from "./components/landing/SocialProof";
import { Pricing } from "./components/landing/Pricing";
import { Faq } from "./components/landing/Faq";
import { FinalCta } from "./components/landing/FinalCta";
import { Footer } from "./components/landing/Footer";
import { StickyMobileCta } from "./components/landing/StickyMobileCta";
import { faqJsonLd, mobileApplicationJsonLd } from "@/lib/seo/jsonld";

export default function HomePage() {
  return (
    <main className="relative overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(mobileApplicationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Nav />
      <Hero />
      <BindySection />
      <HowItWorks />
      <Features />
      <SocialProof />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
      <StickyMobileCta />
    </main>
  );
}
