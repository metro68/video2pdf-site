import type { Metadata } from "next";
import Link from "next/link";
import { TrackedLink } from "@/app/components/TrackedLink";
import { Footer } from "@/app/components/landing/Footer";
import { APP_STORE_URL, PLAY_STORE_URL, SITE_URL } from "@/lib/seo/jsonld";

const PAGE_URL = `${SITE_URL}/how-to-scan-a-book`;
const UPDATED_ISO = "2026-09-04";
const UPDATED_HUMAN = "September 4, 2026";

export const metadata: Metadata = {
  title: "How to Scan a Book With Your Phone | Video2PDF",
  description:
    "Film your book instead of photographing every page: a practical guide to phone book scanning, the mistakes that ruin scans, and how video capture compares to photo scanner apps and flatbeds.",
};

const steps = [
  {
    name: "Set up decent light",
    text: "Daylight or a bright room light works. Angle the book so the light doesn't reflect off the page into the camera; glare is the number one scan killer, especially on glossy paper.",
  },
  {
    name: "Open the book and press record",
    text: "Hold your phone above the book in one hand. No tripod and no careful framing needed; just keep the whole page in the frame.",
  },
  {
    name: "Flip pages at a steady pace",
    text: "Turn a page, let it settle for about a second, then turn the next. The app detects the moment each page settles and picks the sharpest frame, so brief pauses are all it needs.",
  },
  {
    name: "Keep your fingers near the page edges",
    text: "Frames with fingers over the text are skipped automatically, but holding pages by their edges gives the app more clean frames to choose from.",
  },
  {
    name: "Stop recording and review",
    text: "The app extracts each page from the video, straightens it, splits two-page spreads, trims the gutter shadow, and shows you every page with a confidence score before anything is saved.",
  },
  {
    name: "Export your searchable PDF",
    text: "On-device OCR makes every word searchable, so you can find, highlight, copy, and paste from the finished PDF. The scan is even named after the book's title automatically.",
  },
];

const mistakes = [
  {
    title: "Glare on glossy pages",
    body: "Coated textbook paper mirrors light sources. If you can see a bright patch on the page with your eyes, the camera sees it too. Tilt the book or move so the light comes from the side.",
  },
  {
    title: "Flipping too fast",
    body: "The capture needs each page to sit still for a beat. Racing through a chapter gives it motion-blurred frames to work with and pages can be missed.",
  },
  {
    title: "Cutting off page edges",
    body: "Keep a margin of table visible around the book. Perspective correction needs the full page outline to straighten it properly.",
  },
  {
    title: "Filming at a steep angle",
    body: "Roughly overhead is best. Correction handles a casual hand-held angle fine, but text shot from a very low angle loses sharpness that no processing gets back.",
  },
  {
    title: "Dim rooms",
    body: "Low light means longer exposures and softer text. If the page looks murky in your camera preview, OCR accuracy will suffer.",
  },
  {
    title: "A hand resting across the text",
    body: "Finger-avoidance skips blocked frames, but if a hand covers the same paragraph the whole time there is no clean frame to pick. Hold edges, not the middle.",
  },
];

const comparison = [
  {
    method: "Filming with Video2PDF",
    speed: "A chapter in one continuous recording",
    effort: "One hand, no tripod",
    quality: "Straightened, enhanced, searchable PDF",
    bestFor: "Textbooks, notes, handouts, library books",
  },
  {
    method: "Photo scanner apps (Adobe Scan, vFlat, CamScanner)",
    speed: "One photo per page, dozens of captures per chapter",
    effort: "Frame and shoot every page",
    quality: "Good per page; consistency varies across a long session",
    bestFor: "A few pages, receipts, single documents",
  },
  {
    method: "Flatbed or overhead scanner",
    speed: "Slowest per page",
    effort: "Press each spread flat on the glass",
    quality: "The best; archival grade",
    bestFor: "Preservation, rare or fragile books",
  },
  {
    method: "Retyping",
    speed: "Hours per chapter",
    effort: "Maximum",
    quality: "Perfect text, no page images",
    bestFor: "Short excerpts you want to edit",
  },
];

const guideFaq = [
  {
    question: "Do I need a tripod or a scanning rig?",
    answer:
      "No. Video2PDF is designed for hand-held capture. Sharpest-frame selection and perspective correction absorb the wobble of filming with one hand.",
  },
  {
    question: "How does it handle two-page spreads?",
    answer:
      "Open books are captured as spreads, then each spread is split into two single pages and the shadow at the gutter (the fold between pages) is trimmed automatically.",
  },
  {
    question: "Does it work on handwriting?",
    answer:
      "Printed text is where OCR is most reliable. Clear, well-lit handwriting often works, but recognition quality varies with the handwriting itself.",
  },
  {
    question: "How long does a full chapter take?",
    answer:
      "About as long as it takes you to flip through it: one continuous recording with a one-second pause per page, then a short processing pass before you review and export.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "@id": `${PAGE_URL}#article`,
      headline: "How to scan a book with your phone (by filming it)",
      description: metadata.description,
      url: PAGE_URL,
      datePublished: UPDATED_ISO,
      dateModified: UPDATED_ISO,
      author: { "@id": `${SITE_URL}/#organization` },
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
    },
    {
      "@type": "HowTo",
      "@id": `${PAGE_URL}#howto`,
      name: "How to scan a book by filming it with your phone",
      description:
        "Record one continuous video while flipping through a book and turn it into a straightened, searchable PDF.",
      step: steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    },
    {
      "@type": "FAQPage",
      "@id": `${PAGE_URL}#faq`,
      mainEntity: guideFaq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    },
  ],
};

export default function HowToScanABookPage() {
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
            params={{ location: "guide_header" }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Start Free Trial
          </TrackedLink>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary-light">
          Guide
        </p>
        <h1 className="mt-2 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          How to scan a book with your phone (by filming it)
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          By the Video2PDF team at Kaelor Ltd · Last updated {UPDATED_HUMAN}
        </p>

        <div className="mt-8 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            The fastest way to scan a book with a phone is not to photograph
            every page. It is to record one continuous video while you flip
            through the book, then let software pull out each page. A chapter
            that takes dozens of careful photos in a scanner app takes one
            recording this way, with no tripod and no framing.
          </p>
          <p>
            This guide covers the technique, the mistakes that ruin phone
            scans, and an honest comparison with photo scanner apps and
            flatbed scanners, including where they beat us. We build{" "}
            <Link href="/" className="text-primary-light hover:underline">
              Video2PDF
            </Link>
            , the app that does the video part, so the workflow below is the
            one we designed and use ourselves.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Two ways to scan a book with a phone
        </h2>
        <div className="mt-4 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">Photo-per-page:</strong> apps
            like Adobe Scan, vFlat, and CamScanner treat each page as a
            separate photograph. You frame the page, hold still, capture,
            flip, and repeat. Per-page quality is good, but a 40-page chapter
            means 40 careful captures, and consistency drifts as your arm
            tires.
          </p>
          <p>
            <strong className="text-foreground">Continuous video:</strong> you
            record once while flipping. The software watches the footage,
            detects the moment each page settles, skips frames where fingers
            cover text, picks the sharpest frame of each page, straightens
            it, and assembles the PDF. Your job shrinks to turning pages at a
            steady pace.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          What is video book scanning?
        </h2>
        <div className="mt-4 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            Video book scanning means converting one continuous video of a
            book&apos;s pages being turned into a page-accurate, searchable
            PDF. Software analyzes the footage, detects the moment each page
            settles, discards blurred and finger-covered frames, keeps the
            sharpest frame of every page, straightens and enhances it, and
            runs OCR. It is not the same as &quot;video to PDF&quot; frame
            extraction, which just exports evenly spaced screenshots from a
            video; frame extractors do not know what a page is, so they
            produce duplicates, blur, and missed pages when pointed at a
            book.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Step by step: film your book, get a PDF
        </h2>
        <ol className="mt-5 space-y-4">
          {steps.map((s, i) => (
            <li key={s.name} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground">
                {i + 1}. {s.name}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {s.text}
              </p>
            </li>
          ))}
        </ol>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Six mistakes that ruin phone scans
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {mistakes.map((m) => (
            <div key={m.title} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground">{m.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {m.body}
              </p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Video capture vs photo apps vs flatbed scanners
        </h2>
        <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
          Every method has a job it is best at. For archival-quality
          preservation of a rare book, a flatbed scanner still wins and we
          will tell you so. For turning the books and notes you actually
          study from into searchable PDFs quickly, filming wins on effort by
          a wide margin. For an app-by-app breakdown, see our{" "}
          <Link href="/alternatives" className="text-primary-light hover:underline">
            comparison of book scanner apps
          </Link>
          .
        </p>
        <div className="mt-5 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-card text-foreground">
              <tr>
                <th className="p-4 font-semibold">Method</th>
                <th className="p-4 font-semibold">Speed</th>
                <th className="p-4 font-semibold">Effort</th>
                <th className="p-4 font-semibold">Output quality</th>
                <th className="p-4 font-semibold">Best for</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {comparison.map((row) => (
                <tr key={row.method} className="border-t border-border">
                  <td className="p-4 font-medium text-foreground">{row.method}</td>
                  <td className="p-4">{row.speed}</td>
                  <td className="p-4">{row.effort}</td>
                  <td className="p-4">{row.quality}</td>
                  <td className="p-4">{row.bestFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          How do you scan a textbook without a scanner?
        </h2>
        <div className="mt-4 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            You do not need a scanner; your phone camera is enough. For a
            whole textbook, filming is the practical route: record one video
            per chapter while flipping, and let the app extract the pages.
            For just a few pages, any photo scanner app works too. Either
            way you end up with a searchable PDF without buying hardware,
            and without the library scanner queue before exams. If sign-up
            friction bothers you, see which{" "}
            <Link
              href="/scanner-app-no-account"
              className="text-primary-light hover:underline"
            >
              scanner apps work without an account
            </Link>
            .
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          How do you scan a book without damaging it?
        </h2>
        <div className="mt-4 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            The main way books get damaged during scanning is pressure:
            flattening the spine against flatbed glass or cracking it open
            to 180 degrees for a cleaner photo. Filming avoids the problem,
            because the book only needs to be opened as far as comfortable
            reading. Hold pages lightly at the edges, let each spread rest
            at its natural angle, and let perspective correction handle the
            geometry. For rare or fragile books where every handling counts,
            a professional overhead book scanner is still the careful
            choice.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Is it legal to scan a book you own?
        </h2>
        <div className="mt-4 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            In many countries, making a personal-use copy of a book you own
            is treated differently from distributing one. Doctrines like fair
            use in the US and private-copy or fair-dealing rules elsewhere
            often cover digitizing your own books for study, though the
            details vary by country and situation.
          </p>
          <p>
            Sharing scanned copies of copyrighted books with other people is
            a different matter and generally is not covered. This is general
            information, not legal advice; when in doubt, check the rules
            where you live.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Frequently asked questions
        </h2>
        <div className="mt-5 space-y-4">
          {guideFaq.map((item) => (
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
            Try it on the nearest book
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Video2PDF is free to download on iPhone and Android. Film a few
            pages and see the PDF for yourself.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <TrackedLink
              href="/go"
              event="cta_start_trial_clicked"
              params={{ location: "guide_footer" }}
              className="rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Start Free Trial
            </TrackedLink>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <a
                href={APP_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                App Store
              </a>
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                Google Play
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
