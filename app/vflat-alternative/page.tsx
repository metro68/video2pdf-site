import type { Metadata } from "next";
import Link from "next/link";
import { TrackedLink } from "@/app/components/TrackedLink";
import { Footer } from "@/app/components/landing/Footer";
import { SITE_URL } from "@/lib/seo/jsonld";

const PAGE_URL = `${SITE_URL}/vflat-alternative`;
const UPDATED_ISO = "2026-09-04";
const UPDATED_HUMAN = "September 4, 2026";

export const metadata: Metadata = {
  title: "vFlat Alternative: Film the Book Instead | Video2PDF",
  description:
    "Looking for a vFlat Scan alternative? An honest comparison from the makers of Video2PDF: where vFlat is genuinely better, where video capture beats photo-per-spread scanning, and how the two workflows differ page by page.",
};

const compareRows = [
  {
    dim: "Capture method",
    vflat: "Photograph each spread individually",
    v2p: "One continuous video while you flip",
  },
  {
    dim: "A 40-page chapter",
    vflat: "About 20 framed spread captures",
    v2p: "One recording",
  },
  {
    dim: "Page flattening",
    vflat: "Best-in-class AI curve flattening",
    v2p: "Perspective correction + enhancement",
  },
  {
    dim: "Spread handling",
    vflat: "Auto split into two pages",
    v2p: "Auto split + gutter shadow trim",
  },
  {
    dim: "OCR",
    vflat: "Free tier currently 100 pages/day",
    v2p: "Included, on-device",
  },
  {
    dim: "Account",
    vflat: "Optional",
    v2p: "None, no sign-up",
  },
  {
    dim: "Platforms",
    vflat: "iOS and Android",
    v2p: "iOS and Android",
  },
];

const vflatFaq = [
  {
    question: "Is Video2PDF a good alternative to vFlat Scan?",
    answer:
      "If your bottleneck is capture speed, yes: Video2PDF replaces vFlat's photograph-every-spread workflow with one continuous video of you flipping through the book, then extracts, straightens, and OCRs each page automatically. If your priority is maximum control over each individual shot, vFlat remains the best photo-based book scanner.",
  },
  {
    question: "What is vFlat genuinely better at?",
    answer:
      "Curve flattening. vFlat's AI de-warping of curved book pages is best in class, and its deliberate one-spread-at-a-time capture gives you a review of every shot as you go. For a book with heavy page curvature that you want photographed carefully, vFlat is an excellent choice.",
  },
  {
    question: "Do both apps split two-page spreads?",
    answer:
      "Yes. vFlat splits captured spreads into single pages automatically. Video2PDF does the same on pages extracted from your video, and also trims the gutter shadow at the fold.",
  },
  {
    question: "Which is faster for scanning a whole book?",
    answer:
      "Filming is faster by construction: you flip pages at a steady pace in one recording instead of framing and capturing every spread. The trade-off is that vFlat gives you per-shot control during capture, while Video2PDF gives you a review step with confidence scores after extraction.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": `${PAGE_URL}#article`,
      headline: "vFlat alternative: film the book instead of photographing spreads",
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
      mainEntity: vflatFaq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};

export default function VflatAlternativePage() {
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
            params={{ location: "vflat_header" }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Start Free Trial
          </TrackedLink>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-light">
          Comparison
        </p>
        <h1 className="mt-2 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          vFlat alternative: film the book instead of photographing spreads
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          By the Video2PDF team · Last updated {UPDATED_HUMAN}
        </p>

        <div className="mt-8 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            First, credit where it is due:{" "}
            <a
              href="https://www.vflat.com/en"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-light hover:underline"
            >
              vFlat Scan
            </a>{" "}
            is the best photo-based book scanner you can install. Its curve
            flattening is remarkable, it splits spreads automatically, and
            its free OCR tier (currently 100 pages per day) is generous. We
            build Video2PDF, and we still recommend vFlat to people who want
            careful, shot-by-shot capture.
          </p>
          <p>
            The reason people look for a vFlat alternative is almost always
            the same one: the workflow. Photographing a 300-page book means
            framing and capturing roughly 150 spreads, one at a time, with a
            steady hand for each. Video2PDF removes that loop entirely. You
            record one continuous video while flipping through the book; the
            app detects when each page settles, skips frames with fingers
            over text, picks the sharpest frame per page, straightens it,
            splits spreads, trims the gutter, and runs OCR. Capture becomes
            the time it takes to flip the pages.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          vFlat vs Video2PDF, side by side
        </h2>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-card text-foreground">
              <tr>
                <th className="p-4 font-semibold"></th>
                <th className="p-4 font-semibold">vFlat Scan</th>
                <th className="p-4 font-semibold">Video2PDF</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {compareRows.map((row) => (
                <tr key={row.dim} className="border-t border-border">
                  <td className="p-4 font-medium text-foreground">{row.dim}</td>
                  <td className="p-4">{row.vflat}</td>
                  <td className="p-4">{row.v2p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          vFlat details are as documented by VoyagerX at the time of the last
          update above and can change.
        </p>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Pick vFlat if
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>You want to inspect and control every individual capture as you go.</li>
          <li>Your book has heavy page curvature and flattening quality is your top priority.</li>
          <li>You are scanning a handful of pages, where capture speed barely matters.</li>
        </ul>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Pick Video2PDF if
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>You scan whole chapters or whole books and the capture loop is the pain.</li>
          <li>You want zero accounts and OCR included rather than metered.</li>
          <li>
            You would rather review extracted pages once at the end (each with a
            confidence score) than frame every shot up front. Our{" "}
            <Link
              href="/how-to-scan-a-book"
              className="text-primary-light hover:underline"
            >
              guide
            </Link>{" "}
            shows the full workflow.
          </li>
        </ul>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Frequently asked questions
        </h2>
        <div className="mt-5 space-y-4">
          {vflatFaq.map((item) => (
            <div key={item.question} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground">{item.question}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
          Comparing more apps? See the full{" "}
          <Link href="/alternatives" className="text-primary-light hover:underline">
            book scanner app comparison
          </Link>
          , including Adobe Scan, CamScanner, Scanner Pro, and Genius Scan.
        </p>

        <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center">
          <h2 className="text-xl font-bold text-foreground">
            Settle it with one chapter
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Video2PDF is free to download on iPhone and Android. Film a
            chapter you would have photographed spread by spread and compare
            the result.
          </p>
          <TrackedLink
            href="/go"
            event="cta_start_trial_clicked"
            params={{ location: "vflat_footer" }}
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
