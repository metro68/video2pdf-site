import { FUNNEL_CONFIG, finePrint } from "@/lib/funnel/config";

export const SITE_URL = "https://www.video2pdf.ai";
export const APP_STORE_URL = "https://apps.apple.com/app/video2pdf/id6761927204";
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.vid2pdf.app";

const ORG_ID = `${SITE_URL}/#organization`;
const APP_ID = `${SITE_URL}/#app`;

// Verified via the iTunes Lookup API (GB and CA storefronts, 2026-09-04).
// Update only with real store numbers; never hand-edit these upward.
const APP_STORE_RATING = { ratingValue: "5.0", ratingCount: 1 };

/**
 * Site-wide entity graph: who publishes this site and what the site is.
 * The sameAs store links are the disambiguation signal separating this app
 * from the unrelated "video2pdf" tools on GitHub/PyPI and video2pdf.com.
 */
export const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": ORG_ID,
      name: "Video2PDF",
      legalName: "Kaelor Ltd",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/assets/icon.png`,
      },
      description:
        "Video2PDF is a mobile app by Kaelor Ltd that turns a video of any physical book, note, or handout into a clean, searchable PDF. Full-resolution videos, page images, and PDFs stay on the user's device.",
      sameAs: [APP_STORE_URL, PLAY_STORE_URL],
      knowsAbout: [
        "document scanning",
        "optical character recognition (OCR)",
        "on-device AI",
        "PDF conversion",
        "study tools",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "support@video2pdf.ai",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Video2PDF",
      url: SITE_URL,
      description:
        "Film any textbook, note, or handout and get a searchable, shareable PDF in seconds.",
      publisher: { "@id": ORG_ID },
      inLanguage: "en-US",
    },
  ],
};

/** Homepage app entity, priced from FUNNEL_CONFIG so schema cannot drift. */
export const mobileApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  "@id": APP_ID,
  name: "Video2PDF",
  url: SITE_URL,
  description:
    "Record a video of any book, note, or handout and Video2PDF turns it into a straightened, enhanced, fully searchable PDF. Cleanup, enhancement, and OCR run on-device, and full-resolution content never leaves your phone. No account required.",
  operatingSystem: "iOS, Android",
  applicationCategory: "ProductivityApplication",
  applicationSubCategory: "EducationalApplication",
  image: `${SITE_URL}/assets/icon.png`,
  installUrl: APP_STORE_URL,
  downloadUrl: PLAY_STORE_URL,
  author: { "@id": ORG_ID },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: APP_STORE_RATING.ratingValue,
    ratingCount: APP_STORE_RATING.ratingCount,
    bestRating: "5",
  },
  featureList: [
    "Smart page detection from continuous video",
    "Hand and finger avoidance",
    "Perspective correction and page straightening",
    "Adaptive enhancement for shadows and glare",
    "Searchable OCR text (copy, paste, highlight)",
    "Full-resolution content stays on your phone; no account required",
  ],
  offers: {
    "@type": "Offer",
    name: "Video2PDF Pro, annual",
    price: (FUNNEL_CONFIG.plans.annual.cents / 100).toFixed(2),
    priceCurrency: "USD",
    category: "subscription",
    availability: "https://schema.org/InStock",
    url: `${SITE_URL}/go`,
    description: finePrint(
      `${FUNNEL_CONFIG.plans.annual.price}/year`,
      FUNNEL_CONFIG.plans.annual.trialDays,
    ),
  },
};

/** /go pricing: the plan picker is client-rendered, so this block is the only
 *  way non-JS crawlers (GPTBot, ClaudeBot, PerplexityBot) see prices at all. */
export const goOffersJsonLd = {
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  "@id": APP_ID,
  name: "Video2PDF",
  url: SITE_URL,
  operatingSystem: "iOS, Android",
  applicationCategory: "ProductivityApplication",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: (FUNNEL_CONFIG.plans.weekly.cents / 100).toFixed(2),
    highPrice: (FUNNEL_CONFIG.plans.annual.cents / 100).toFixed(2),
    priceCurrency: "USD",
    offerCount: 2,
    offers: [
      {
        "@type": "Offer",
        name: "Video2PDF Pro, weekly",
        price: (FUNNEL_CONFIG.plans.weekly.cents / 100).toFixed(2),
        priceCurrency: "USD",
        category: "subscription",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/go`,
        description: finePrint(
          `${FUNNEL_CONFIG.plans.weekly.price}/week`,
          FUNNEL_CONFIG.plans.weekly.trialDays,
        ),
      },
      {
        "@type": "Offer",
        name: "Video2PDF Pro, annual",
        price: (FUNNEL_CONFIG.plans.annual.cents / 100).toFixed(2),
        priceCurrency: "USD",
        category: "subscription",
        availability: "https://schema.org/InStock",
        url: `${SITE_URL}/go`,
        description: finePrint(
          `${FUNNEL_CONFIG.plans.annual.price}/year`,
          FUNNEL_CONFIG.plans.annual.trialDays,
        ),
      },
    ],
  },
};

/** Q&A pairs rendered visibly in the homepage FAQ section; the FAQPage schema
 *  below must always mirror this exact visible text. */
export const faqItems = [
  {
    question: "Does Video2PDF upload my books or notes?",
    answer:
      "Your full-resolution video, page images, and finished PDFs stay on your phone. Cleanup, enhancement, and text recognition run on-device. Only reduced-resolution copies of sampled frames are sent to our servers to detect and order pages, and they're deleted right after; they are never used to train AI models. No account or sign-up is required.",
  },
  {
    question: "How does Video2PDF work?",
    answer:
      "Open your book, press record, and slowly pan while you flip through the pages. One continuous video is all it takes: the app finds each settled page, skips frames with fingers in them, picks the sharpest frame, straightens it, and builds your PDF.",
  },
  {
    question: "Is the PDF searchable?",
    answer:
      "Yes. Every word is recognized with on-device OCR, so you can search, highlight, copy, and paste straight out of your PDF.",
  },
  {
    question: "How much does Video2PDF cost?",
    answer:
      "Video2PDF is free to download on iPhone and Android. Video2PDF Pro is $29.99 per year with a 3-day free trial; cancel anytime before the trial ends and you won't be charged. A weekly plan at $4.99 per week is also available.",
  },
  {
    question: "How is it different from scanner apps like CamScanner or vFlat?",
    answer:
      "Page-at-a-time scanner apps make you photograph every page separately. Video2PDF captures pages from one continuous video while you flip through the book, so a whole chapter takes one recording instead of dozens of photos.",
  },
  {
    question: "What devices does it support?",
    answer:
      "Video2PDF runs on iPhone and Android phones. You'll need an internet connection while a scan is processed for page detection; your video and finished PDFs stay on your phone.",
  },
] as const;

export const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};
