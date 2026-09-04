import type { Metadata } from "next";
import Link from "next/link";
import { TrackedLink } from "@/app/components/TrackedLink";
import { Footer } from "@/app/components/landing/Footer";
import { APP_STORE_URL, PLAY_STORE_URL, SITE_URL } from "@/lib/seo/jsonld";

const PAGE_URL = `${SITE_URL}/about`;

export const metadata: Metadata = {
  title: "About Video2PDF | Kaelor Ltd",
  description:
    "Video2PDF is built by Kaelor Ltd: a small independent team making the fastest way to turn physical books, notes, and handouts into searchable PDFs with a phone.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": `${PAGE_URL}#aboutpage`,
  url: PAGE_URL,
  name: "About Video2PDF",
  about: { "@id": `${SITE_URL}/#organization` },
  inLanguage: "en-US",
};

export default function AboutPage() {
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
            params={{ location: "about_header" }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Start Free Trial
          </TrackedLink>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
          About Video2PDF
        </h1>

        <div className="mt-8 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            Video2PDF is a mobile app for iPhone and Android that turns a
            hand-held video of a physical book, notebook, or handout into a
            clean, searchable PDF. Instead of photographing pages one at a
            time, you record once while flipping through the book; the app
            finds each page in the footage, straightens and enhances it, and
            makes every word searchable.
          </p>
          <p>
            It started as a student problem. We were digitizing textbooks and
            lecture notes with the usual scanner apps, photographing pages one
            at a time, reframing every shot, and giving up halfway through a
            chapter. Filming felt like the obvious capture method, but no app
            could turn a video of page flips into a usable PDF. So we built
            the one that could.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Who makes it
        </h2>
        <div className="mt-4 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            Video2PDF is built by{" "}
            <strong className="text-foreground">Kaelor Ltd</strong>, a small
            independent software company started by students who were tired
            of scanning each page one by one. There is no growth team and no
            sales department; the people who answer{" "}
            <a
              href="mailto:support@video2pdf.ai"
              className="text-primary-light hover:underline"
            >
              support@video2pdf.ai
            </a>{" "}
            are the people who build the app.
          </p>
          <p>
            The scanning pipeline is our own work: page-settle detection,
            finger avoidance, sharpest-frame selection, perspective
            correction, spread splitting, and OCR, refined against real
            books, real lecture notes, and real hand wobble.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          How we handle your data
        </h2>
        <div className="mt-4 space-y-5 text-pretty leading-relaxed text-muted-foreground">
          <p>
            There are no accounts and no sign-up. Your full-resolution
            videos, page images, and finished PDFs stay on your phone;
            cleanup, enhancement, and text recognition run on-device. Only
            reduced-resolution copies of sampled frames are sent to our
            servers to detect and order pages, and they are deleted right
            after processing. The full detail is in our{" "}
            <Link href="/privacy" className="text-primary-light hover:underline">
              privacy policy
            </Link>
            .
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-bold tracking-tight text-foreground">
          Where to find us
        </h2>
        <ul className="mt-4 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>
            App Store:{" "}
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-light hover:underline"
            >
              Video2PDF for iPhone
            </a>
          </li>
          <li>
            Google Play:{" "}
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-light hover:underline"
            >
              Video2PDF for Android
            </a>
          </li>
          <li>
            Support:{" "}
            <a
              href="mailto:support@video2pdf.ai"
              className="text-primary-light hover:underline"
            >
              support@video2pdf.ai
            </a>
          </li>
          <li>
            Guide:{" "}
            <Link
              href="/how-to-scan-a-book"
              className="text-primary-light hover:underline"
            >
              How to scan a book with your phone
            </Link>
          </li>
        </ul>
      </main>

      <Footer />
    </>
  );
}
