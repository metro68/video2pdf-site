import type { Metadata } from "next";
import Link from "next/link";
import { TrackedLink } from "@/app/components/TrackedLink";
import { Footer } from "@/app/components/landing/Footer";
import { SITE_URL } from "@/lib/seo/jsonld";

const PAGE_URL = `${SITE_URL}/microsoft-lens-alternative`;
const UPDATED_ISO = "2026-09-04";
const UPDATED_HUMAN = "September 4, 2026";

export const metadata: Metadata = {
  title: "Microsoft Lens Alternatives Now That It's Retired | Video2PDF",
  description:
    "Microsoft Lens was retired in 2026 and scanning is disabled. Here is what to use instead, by job: books and long documents, everyday paperwork, and whiteboards, with honest picks including apps we don't make.",
};

const picks = [
  {
    job: "Scanning books, textbooks, and long documents",
    pick: "Video2PDF or vFlat Scan",
    why: "Lens was never built for books; every page was a separate capture. Video2PDF replaces the whole loop: record one continuous video while flipping pages and it extracts, straightens, and OCRs every page into a searchable PDF, with no account. If you prefer photographing spread by spread with maximum per-shot control, vFlat's curve flattening is best in class.",
  },
  {
    job: "Everyday paperwork, receipts, and contracts",
    pick: "Genius Scan or Adobe Scan",
    why: "Genius Scan is the closest match to what Lens users liked: free unlimited scanning, no account, on-device processing (its OCR is a paid add-on). Adobe Scan gives you strong free OCR and the Acrobat ecosystem, at the price of requiring an Adobe account and a current 25-page OCR cap per file.",
  },
  {
    job: "Whiteboards and meeting captures",
    pick: "OneDrive's built-in scanner or Adobe Scan",
    why: "Microsoft points Lens users to the scanner inside the OneDrive app. It is more basic than Lens was, but for whiteboard shots that land in Microsoft 365 anyway, it is the path of least resistance. Adobe Scan's whiteboard mode is the stronger standalone option.",
  },
];

const lensFaq = [
  {
    question: "Why was Microsoft Lens discontinued?",
    answer:
      "Microsoft retired Lens in phases across early 2026: it was pulled from the app stores and scan creation was disabled in the app. Microsoft directs users to the scanning feature inside the OneDrive app instead, which covers basic document capture but not the full Lens feature set.",
  },
  {
    question: "What is the best Microsoft Lens replacement for scanning books?",
    answer:
      "A book-specific app. Video2PDF turns one continuous video of you flipping through a book into a searchable PDF with no account required. vFlat Scan is the strongest photo-per-spread alternative. General-purpose Lens replacements make you photograph every page individually, which is the slowest part of scanning a book.",
  },
  {
    question: "Is there a free Lens replacement without an account?",
    answer:
      "Yes. Genius Scan scans without any account and processes on-device (OCR is paid). Video2PDF also requires no account or sign-up, and is free to download with OCR included. Adobe Scan is free but requires an Adobe account.",
  },
  {
    question: "Can I still open my old Lens scans?",
    answer:
      "Scans you exported as PDFs or images remain normal files and open anywhere. The retirement removed the app and its capture features, not your exported documents.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": `${PAGE_URL}#article`,
      headline: "Microsoft Lens alternatives now that it's retired",
      description: metadata.description,
      url: PAGE_URL,
      datePublished: UPDATED_ISO,
      dateModified: UPDATED_ISO,
      author: { "@id": `${SITE_URL}/#organization` },
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": "FAQPage",
      "@id": `${PAGE_URL}#faq`,
      mainEntity: lensFaq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};

export default function MicrosoftLensAlternativePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <img
              src="/assets/icon-192.png"
              alt="Video2PDF logo"
              width={32}
              height={32}
              className="size-8 rounded-lg object-cover"
            />
            <span className="text-lg font-bold tracking-tight text-foreground">
              Video<span className="text-primary-light">2</span>PDF
            </span>
          </Link>
          <TrackedLink
            href="/go"
            event="cta_start_trial_clicked"
            params={{ location: "lens_header" }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Start Free Trial
          </TrackedLink>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-light">
          Switching guide
        </p>
        <h1 className="mt-2 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          Microsoft Lens alternatives now that it&apos;s retired
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          By the Video2PDF team · Last updated {UPDATED_HUMAN}
        </p>

        <div className="mt-8 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            Microsoft retired Lens in early 2026: the app was removed from
            the App Store and Google Play, and scan creation inside the app
            was disabled shortly after (
            <a
              href="https://support.microsoft.com/en-us/lens/retirement-of-microsoft-lens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-light hover:underline"
            >
              Microsoft&apos;s retirement notice
            </a>
            ). Microsoft&apos;s suggested replacement is the scanner built
            into the OneDrive app, which is deliberately simpler than Lens
            was.
          </p>
          <p>
            We build Video2PDF, a book-scanning app, so we have an obvious
            horse in this race. But Lens did several jobs, and the honest
            answer is that no single app replaces all of them. Pick by the
            job you actually used Lens for.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          The right replacement, by job
        </h2>
        <div className="mt-5 space-y-4">
          {picks.map((p) => (
            <div key={p.job} className="rounded-2xl border border-border bg-card p-6">
              <h3 className="font-semibold text-foreground">{p.job}</h3>
              <p className="mt-1 text-sm font-medium text-primary-light">{p.pick}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.why}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Where Video2PDF fits, and where it doesn&apos;t
        </h2>
        <div className="mt-4 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            If Lens was your tool for digitizing textbooks, lecture notes,
            or anything longer than a few pages, Video2PDF replaces that job
            with a fundamentally faster capture method: one continuous
            recording instead of a photo per page, then automatic page
            extraction, straightening, spread splitting, and on-device OCR.
            Like Lens at its best, it needs no account. Our{" "}
            <Link
              href="/how-to-scan-a-book"
              className="text-primary-light hover:underline"
            >
              book scanning guide
            </Link>{" "}
            shows the technique.
          </p>
          <p>
            If Lens was your receipts-and-whiteboards tool, we are not the
            right pick and the apps above are. Our full{" "}
            <Link href="/alternatives" className="text-primary-light hover:underline">
              scanner app comparison
            </Link>{" "}
            covers the trade-offs in detail.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Frequently asked questions
        </h2>
        <div className="mt-5 space-y-4">
          {lensFaq.map((item) => (
            <div key={item.question} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground">{item.question}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-bold text-foreground">
            Scanning books? Try the video way
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Free to download on iPhone and Android. Film a chapter and see
            the searchable PDF for yourself.
          </p>
          <TrackedLink
            href="/go"
            event="cta_start_trial_clicked"
            params={{ location: "lens_footer" }}
            className="mt-5 inline-block rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Start Free Trial
          </TrackedLink>
        </div>
      </main>

      <Footer />
    </>
  );
}
