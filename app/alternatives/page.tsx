import type { Metadata } from "next";
import Link from "next/link";
import { TrackedLink } from "@/app/components/TrackedLink";
import { Footer } from "@/app/components/landing/Footer";
import { SITE_URL } from "@/lib/seo/jsonld";

const PAGE_URL = `${SITE_URL}/alternatives`;
const UPDATED_ISO = "2026-09-04";
const UPDATED_HUMAN = "September 4, 2026";

export const metadata: Metadata = {
  title: "Video2PDF Alternatives: Book Scanner Apps Compared | Video2PDF",
  description:
    "An honest comparison of Video2PDF with vFlat, Adobe Scan, CamScanner, Scanner Pro, Genius Scan, and retired Microsoft Lens: capture method, book mode, OCR limits, accounts, and when each app is the better pick.",
};

const tableRows = [
  {
    app: "Video2PDF",
    capture: "Continuous video of page flips",
    bookMode: "Yes: spread split + gutter trim",
    ocr: "Included, on-device",
    account: "None",
    platforms: "iOS, Android",
  },
  {
    app: "vFlat Scan",
    capture: "Photo per spread",
    bookMode: "Yes: curve flattening",
    ocr: "Free, currently 100 pages/day",
    account: "Optional",
    platforms: "iOS, Android",
  },
  {
    app: "Adobe Scan",
    capture: "Photo per page/spread",
    bookMode: "Yes: book capture",
    ocr: "Free, currently capped at 25 pages/file",
    account: "Adobe account required",
    platforms: "iOS, Android",
  },
  {
    app: "CamScanner",
    capture: "Photo per page",
    bookMode: "Basic",
    ocr: "Paid tiers",
    account: "Required for most features",
    platforms: "iOS, Android",
  },
  {
    app: "Scanner Pro",
    capture: "Photo per spread",
    bookMode: "Yes: dedicated Book Mode",
    ocr: "Included (subscription)",
    account: "Optional",
    platforms: "iOS only",
  },
  {
    app: "Genius Scan",
    capture: "Photo per page",
    bookMode: "No",
    ocr: "Paid add-on",
    account: "None",
    platforms: "iOS, Android",
  },
  {
    app: "Microsoft Lens",
    capture: "Photo per page",
    bookMode: "No",
    ocr: "Was free",
    account: "Microsoft account",
    platforms: "Retired in 2026",
  },
];

const competitors = [
  {
    name: "vFlat Scan",
    url: "https://www.vflat.com/en",
    linkLabel: "vflat.com",
    best: "vFlat is the strongest photo-based book scanner. Its AI curve flattening is best in class: pages photographed over an open book come out remarkably flat, it splits two-page spreads automatically, removes fingers, and its free tier currently includes OCR for up to 100 pages per day.",
    tradeoff:
      "The workflow is still photo-per-spread: you frame and capture every spread yourself, which is exactly the repetition Video2PDF removes. If you prefer deliberate single captures with maximum per-shot control, vFlat is an excellent choice.",
  },
  {
    name: "Adobe Scan",
    url: "https://www.adobe.com/acrobat/mobile/scanner-app.html",
    linkLabel: "adobe.com",
    best: "Free, mature, and backed by the Acrobat ecosystem. Its book capture mode handles spreads, OCR quality is strong, and if your documents already live in Adobe's cloud it fits right in.",
    tradeoff:
      "It requires an Adobe account, and free OCR is currently capped at 25 pages per file, which a single textbook chapter can exceed. Long-book scanning is not what it is built for.",
  },
  {
    name: "CamScanner",
    url: "https://www.camscanner.com",
    linkLabel: "camscanner.com",
    best: "The most feature-rich general document app of the group: annotation, format conversion, editing, and sharing tools go well beyond capture.",
    tradeoff:
      "The free tier watermarks output, the app pushes its subscription hard, and book scanning is a side feature rather than the focus.",
  },
  {
    name: "Scanner Pro",
    url: "https://readdle.com/scannerpro",
    linkLabel: "readdle.com",
    best: "Readdle's scanner is polished, and its dedicated Book Mode captures both pages of a spread at once with clean perspective correction. On iOS it is the tidiest photo-based book workflow.",
    tradeoff:
      "iOS only, subscription-based, and still photo-per-spread capture: a long book means holding a steady frame over every spread.",
  },
  {
    name: "Genius Scan",
    url: "https://thegrizzlylabs.com/genius-scan",
    linkLabel: "thegrizzlylabs.com",
    best: "A privacy-focused general scanner with unlimited free scans, no account, and processing on your device. As a receipts-and-documents scanner it is excellent.",
    tradeoff:
      "There is no book mode, and OCR is a paid add-on, so a searchable textbook chapter costs both the upgrade and a lot of per-page captures.",
  },
  {
    name: "Microsoft Lens (retired)",
    url: "https://support.microsoft.com/en-us/lens/retirement-of-microsoft-lens",
    linkLabel: "Microsoft's retirement notice",
    best: "Lens was many people's free default for years, and its whiteboard and document modes were genuinely good.",
    tradeoff:
      "Microsoft retired it in early 2026; it was pulled from the app stores and scanning was disabled. Microsoft points users to the more basic scanner inside OneDrive, which is why many former Lens users are choosing a new scanner app right now.",
  },
];

const altFaq = [
  {
    question: "What is the best alternative to Video2PDF?",
    answer:
      "vFlat Scan is the closest alternative: it is also built specifically for books, with excellent curve flattening and automatic spread splitting. The core difference is capture method: vFlat photographs each spread individually while Video2PDF extracts pages from one continuous video of you flipping through the book.",
  },
  {
    question: "Which book scanner app has no account requirement?",
    answer:
      "Video2PDF and Genius Scan both work without any account or sign-up. Adobe Scan requires an Adobe account, and CamScanner requires an account for most features.",
  },
  {
    question: "What should Microsoft Lens users switch to?",
    answer:
      "Microsoft Lens was retired in early 2026. For scanning books and long documents, Video2PDF or vFlat are the book-focused picks; for general receipts and paperwork, Genius Scan or Adobe Scan cover what Lens did.",
  },
  {
    question: "When is Video2PDF not the right choice?",
    answer:
      "For archival-quality preservation of rare or fragile books, a flatbed scanner still beats any phone app. For turning handwriting into editable text rather than searchable page images, a transcription tool like Pen to Print or GoodNotes is the better fit. And for the occasional single receipt, any free scanner app does the job.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": `${PAGE_URL}#article`,
      headline: "Video2PDF alternatives: book scanner apps compared",
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
      mainEntity: altFaq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};

export default function AlternativesPage() {
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
            params={{ location: "alternatives_header" }}
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
          Video2PDF alternatives: book scanner apps compared
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          By the Video2PDF team at Kaelor Ltd · Last updated {UPDATED_HUMAN}
        </p>

        <div className="mt-8 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            We build Video2PDF, so read this with that in mind. But we would
            rather you pick the right scanner than pick us for the wrong job,
            so this comparison is honest about where each app wins, including
            the cases where a competitor or even a flatbed scanner is the
            better choice.
          </p>
          <p>
            The core split is capture method. Every app below except ours
            photographs pages or spreads one at a time. Video2PDF extracts
            pages from one continuous video of you flipping through the book,
            which is the difference between forty captures per chapter and
            one recording. Our{" "}
            <Link
              href="/how-to-scan-a-book"
              className="text-primary-light hover:underline"
            >
              book scanning guide
            </Link>{" "}
            covers the technique.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          At a glance
        </h2>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-card text-foreground">
              <tr>
                <th className="p-4 font-semibold">App</th>
                <th className="p-4 font-semibold">Capture method</th>
                <th className="p-4 font-semibold">Book mode</th>
                <th className="p-4 font-semibold">OCR</th>
                <th className="p-4 font-semibold">Account</th>
                <th className="p-4 font-semibold">Platforms</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {tableRows.map((row) => (
                <tr key={row.app} className="border-t border-border">
                  <td className="p-4 font-medium text-foreground">{row.app}</td>
                  <td className="p-4">{row.capture}</td>
                  <td className="p-4">{row.bookMode}</td>
                  <td className="p-4">{row.ocr}</td>
                  <td className="p-4">{row.account}</td>
                  <td className="p-4">{row.platforms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Limits and tiers are as documented by each vendor at the time of the
          last update above and can change.
        </p>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          The alternatives, honestly
        </h2>
        <div className="mt-5 space-y-8">
          {competitors.map((c) => (
            <div key={c.name}>
              <h3 className="text-xl font-bold text-foreground">{c.name}</h3>
              <div className="mt-2 space-y-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                <p>
                  <strong className="text-foreground">Where it wins:</strong>{" "}
                  {c.best}
                </p>
                <p>
                  <strong className="text-foreground">The trade-off:</strong>{" "}
                  {c.tradeoff}
                </p>
                <p>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-light hover:underline"
                  >
                    {c.linkLabel}
                  </a>
                </p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Frequently asked questions
        </h2>
        <div className="mt-5 space-y-4">
          {altFaq.map((item) => (
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
            The fastest way to find out is a chapter
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Video2PDF is free to download. Film a few pages of the nearest
            book and compare the PDF yourself.
          </p>
          <TrackedLink
            href="/go"
            event="cta_start_trial_clicked"
            params={{ location: "alternatives_footer" }}
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
