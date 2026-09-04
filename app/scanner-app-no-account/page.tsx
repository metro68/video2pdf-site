import type { Metadata } from "next";
import Link from "next/link";
import { TrackedLink } from "@/app/components/TrackedLink";
import { Footer } from "@/app/components/landing/Footer";
import { SITE_URL } from "@/lib/seo/jsonld";

const PAGE_URL = `${SITE_URL}/scanner-app-no-account`;
const UPDATED_ISO = "2026-09-04";
const UPDATED_HUMAN = "September 4, 2026";

export const metadata: Metadata = {
  title: "Scanner Apps That Don't Require an Account | Video2PDF",
  description:
    "Scanner apps you can use without signing up: which apps scan with no account (Video2PDF, Genius Scan, PDFgear), which require one (Adobe Scan, CamScanner), and why account-free matters for scanning your own books and notes.",
};

const apps = [
  {
    name: "Video2PDF",
    account: "No account, no sign-up",
    notes:
      "Book-focused: turns one continuous video of page flips into a straightened, searchable PDF. OCR included. Full-resolution videos, page images, and PDFs stay on your phone.",
    ours: true,
  },
  {
    name: "Genius Scan",
    account: "No account",
    notes:
      "Excellent general document scanner with on-device processing and unlimited free scans. OCR is a paid add-on, and there is no book mode.",
    ours: false,
  },
  {
    name: "PDFgear Scan",
    account: "No sign-up required",
    notes:
      "Free general-purpose scanner from a PDF software company. Solid for everyday documents; no book specialization.",
    ours: false,
  },
  {
    name: "Adobe Scan",
    account: "Adobe account required",
    notes:
      "Strong free OCR (currently capped at 25 pages per file) and a real book mode, but you cannot use it without signing in.",
    ours: false,
  },
  {
    name: "CamScanner",
    account: "Account required for most features",
    notes:
      "Feature-rich document suite, but the free tier watermarks output and the app is built around its subscription.",
    ours: false,
  },
];

const noAccountFaq = [
  {
    question: "Which scanner app works without creating an account?",
    answer:
      "Video2PDF, Genius Scan, and PDFgear Scan all scan without any account or sign-up. Adobe Scan requires an Adobe account, and CamScanner requires an account for most features.",
  },
  {
    question: "Why does it matter whether a scanner app needs an account?",
    answer:
      "An account links your scans to an identity and usually to a cloud service. For personal material like your own books, notes, and paperwork, an account adds sign-up friction, marketing email, and a dependency: if the service changes its terms or shuts down, your workflow breaks with it.",
  },
  {
    question: "Does no account mean my scans stay on my phone?",
    answer:
      "Not automatically; the two things are separate, so check each app. In Video2PDF, your full-resolution video, page images, and finished PDFs stay on your phone; only reduced-resolution copies of sampled frames are sent to our servers to detect and order pages, then deleted.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": `${PAGE_URL}#article`,
      headline: "Scanner apps that don't require an account",
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
      mainEntity: noAccountFaq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};

export default function ScannerAppNoAccountPage() {
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
            params={{ location: "noaccount_header" }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Start Free Trial
          </TrackedLink>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-light">
          No sign-up scanning
        </p>
        <h1 className="mt-2 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          Scanner apps that don&apos;t require an account
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          By the Video2PDF team · Last updated {UPDATED_HUMAN}
        </p>

        <div className="mt-8 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            Scanning a page of your own notes should not start with creating
            an account. Yet two of the biggest scanner apps will not work
            without one. Here is the honest account-requirement map,
            including apps we do not make.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          The account-requirement map
        </h2>
        <div className="mt-5 space-y-4">
          {apps.map((a) => (
            <div key={a.name} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-foreground">
                  {a.name}
                  {a.ours ? (
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      (that&apos;s us)
                    </span>
                  ) : null}
                </h3>
                <span className="text-sm font-medium text-primary-light">{a.account}</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.notes}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Account requirements are as documented by each vendor at the time of
          the last update above and can change.
        </p>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Frequently asked questions
        </h2>
        <div className="mt-5 space-y-4">
          {noAccountFaq.map((item) => (
            <div key={item.question} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground">{item.question}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
          Scanning books specifically? See{" "}
          <Link
            href="/how-to-scan-a-book"
            className="text-primary-light hover:underline"
          >
            how to scan a book with your phone
          </Link>{" "}
          and the full{" "}
          <Link href="/alternatives" className="text-primary-light hover:underline">
            scanner app comparison
          </Link>
          .
        </p>

        <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-bold text-foreground">
            Scan a book without signing up for anything
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Download Video2PDF free on iPhone or Android and film your first
            chapter. No account, no sign-up.
          </p>
          <TrackedLink
            href="/go"
            event="cta_start_trial_clicked"
            params={{ location: "noaccount_footer" }}
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
