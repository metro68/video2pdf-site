import { Nav } from "./components/landing/Nav";
import { Hero } from "./components/landing/Hero";
import { HowItWorks } from "./components/landing/HowItWorks";
import { Features } from "./components/landing/Features";
import { BindySection } from "./components/landing/BindySection";
import { SocialProof } from "./components/landing/SocialProof";
import { Pricing } from "./components/landing/Pricing";
import { FinalCta } from "./components/landing/FinalCta";
import { Footer } from "./components/landing/Footer";
import { StickyMobileCta } from "./components/landing/StickyMobileCta";

export default function HomePage() {
  return (
    <main className="relative overflow-x-hidden">
      <Nav />
      <Hero />
      <HowItWorks />
      <BindySection />
      <Features />
      <SocialProof />
      <Pricing />
      <FinalCta />
      <Footer />
      <StickyMobileCta />
    </main>
  );
}
