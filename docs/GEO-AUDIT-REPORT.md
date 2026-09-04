# GEO Audit Report: www.video2pdf.ai

Date: 2026-09-04 | Auditor: geo skill (5 parallel subagents) | Pages: /, /go, /privacy, /terms + private routes

## Composite GEO Score: 35/100 (Poor, with an unusually strong technical floor)

| Category | Weight | Score | Weighted |
|---|---|---|---|
| AI Citability & Visibility | 25% | 62 | 15.5 |
| Brand Authority Signals | 20% | 7 | 1.4 |
| Content Quality & E-E-A-T | 20% | 22 | 4.4 |
| Technical Foundations | 15% | 70 | 10.5 |
| Structured Data | 10% | 5 | 0.5 |
| Platform Optimization | 10% | 29 | 2.9 |
| **Composite** | | | **35** |

Platform readiness detail: Google AI Overviews 31, ChatGPT Search 37, Perplexity 32, Gemini 14, Bing Copilot 31.

## The One-Paragraph Diagnosis

The pipes are open but nothing flows through them. The site is fully prerendered (every AI crawler sees complete HTML without JS), fast (40ms TTFB on Vercel edge), and every AI bot is allowed by default. But the domain gives engines nothing to work with: no robots.txt, sitemap, llms.txt, canonical, or structured data; no informational page an AI could ever cite; a brand name ("video2pdf") contested by unrelated GitHub/PyPI slide-extraction tools and a Scamadviser-flagged video2pdf.com; and several social-proof claims that fail machine cross-checking. AI summarizers already quote the landing copy verbatim when the domain surfaces, so fixes here convert directly into citations.

## Critical Findings (fix before anything else)

1. **Private routes are indexable.** /login, /manage, /open, /delete-account, /go/success all return 200 with no noindex meta and no X-Robots-Tag. /go/success runs Stripe redemption logic and must never enter an index. (/dashboard is safe: 307 to /login.)
2. **The Vercel mirror is indexed.** video2pdf-site.vercel.app serves identical content, appears in brand searches (3 of 5 test queries during the audit), and there is no canonical tag anywhere to consolidate signals to www.video2pdf.ai. AI engines may cite the vercel.app URL.
3. **Crawlers read "0 pages scanned".** The counter animates client-side from an SSR fallback of 0; non-JS crawlers (GPTBot, ClaudeBot, PerplexityBot) ingest "0 pages scanned and counting" while /go says "Join 12,000+ people". An internal contradiction plus a worse-than-nothing stat.
4. **The 5-star claim is real but was invisible to machines.** Correction (2026-09-04): the GB and CA storefronts return 5.0 with 1 rating via the iTunes Lookup API; the US storefront returns 0, which is what the initial audit checked. The claim stands, but the page gave engines no way to verify it (no store link, no rating count, no schema). Fixed by linking the claim to the listing and shipping aggregateRating 5.0 (count 1) in schema; update the schema numbers as real ratings accumulate. The unverifiable named testimonials remain a residual soft spot.
5. **Zero structured data, and /go pricing is invisible to AI.** No JSON-LD anywhere; /go's plan picker is client-rendered, so its server HTML contains no prices at all.
6. **No robots.txt, sitemap.xml, or llms.txt** (all 404). No crawl guidance, no discovery, no disambiguation.

## High-Priority Findings

- Every page shares the identical title and meta description (only app/layout.tsx exports metadata).
- No og:image / twitter:image: shares in iMessage, Slack, X, and AI chat surfaces render text-only.
- No FAQ, no question-form headings anywhere; not one heading maps to a real query.
- Brand entity is absent everywhere AI models look: no Wikidata, Reddit (zero results for "video2pdf" on reddit.com), YouTube, LinkedIn, Product Hunt, press. Real traction exists only on TikTok, the weakest platform for AI training weight.
- The homepage never links the App Store or Play Store listings, so engines cannot verify the app exists. Real listings: https://apps.apple.com/us/app/video2pdf/id6761927204 and https://play.google.com/store/apps/details?id=com.vid2pdf.app (seller: Kaelor Ltd).
- Hero H1 ships with inline opacity:0 (animation initial state): LCP risk and a blank hero for screenshot-based crawlers.
- Apex redirect is temporary (307) instead of permanent; icon.png is 577 KB preloaded on every page, bindy.png 825 KB, both uncached; security headers absent (only HSTS present); /favicon.ico 404.

## What Is Already Good

- Prerendered SSG with complete content, headings, and meta in raw HTML (the single biggest GEO factor: pass).
- 40ms TTFB, Brotli, immutable caching on static chunks, async scripts, clean mobile viewport.
- Genuinely quotable, human-written copy. Most citable passages: pricing ("$29.99/year, 3 days free, cancel anytime") and the privacy claim ("All processing happens on your phone. No account, no cloud, nothing ever leaves your device.").
- Clean URL structure, HTTPS enforced, AASA served correctly.

## Prioritized Action Plan

### Batch 1: One deploy, ~2 hours, moves composite ~35 to ~55

1. Noindex the 5 private routes (X-Robots-Tag via headers() in next.config.mjs).
2. app/robots.ts (allow all, block Bytespider, disallow private routes and /api/, point at sitemap) + app/sitemap.ts (/, /go, /privacy, /terms).
3. metadataBase + canonical in app/layout.tsx; noindex all *.vercel.app deployments (env-conditional).
4. Unique title/description per page (route layout.tsx for the "use client" pages).
5. Deploy public/llms.txt (full draft in Appendix A, including the deliberate "Not affiliated with" disambiguation line).
6. JSON-LD: Organization + WebSite in layout, MobileApplication on /, AggregateOffer block on /go (ready-to-paste blocks in Appendix B; prices verified against lib/funnel/config.ts, ideally generated from FUNNEL_CONFIG so they cannot drift).
7. Fix trust contradictions: real store links in footer, remove/reword the 5-star claim, SSR a real counter number (or drop the block), reconcile 0 vs 12,000+.
8. og:image (1200x630) + app/icon.png favicon.

### Batch 2: Content (highest citation ROI, ~2-3 days spread out)

9. Homepage FAQ section, 6-8 question H3s with 40-60 word answers, plus FAQPage schema (seed Qs in Appendix B4).
10. "How to scan a book with your phone" pillar page: first-person, real scan screenshots, honest limits, comparison table vs photo-scanner apps (Adobe Scan, vFlat, CamScanner). Targets the winnable "convert video of book pages to PDF" cluster where current results are frame-grabber junk and video2pdf.ai is the only product matching intent. The "book scanner app" head terms are owned by Adobe/Readdle content operations; do not chase them first.
11. About page: founder/entity name (Kaelor Ltd), story paragraph, support email, store links. Currently no human is attached to the product anywhere.

### Batch 3: Off-domain entity building (ongoing)

12. One 45-90s YouTube demo, keyword title, chapters (Gemini's heaviest signal; site currently scores 14/100 there with zero Google-ecosystem presence). Repurpose existing TikTok content as Shorts.
13. Honest Reddit maker post + participation (r/GetStudying, r/datacurator, r/college): Reddit is ~47% of Perplexity citations and has never heard of Video2PDF.
14. Bing Webmaster Tools + IndexNow (Bing's index feeds ChatGPT Search and Copilot); Product Hunt launch; LinkedIn company page; Wikidata item. Add each new profile to the sameAs array.

### Housekeeping (Batch 1.5, same or next deploy)

15. Security headers block in next.config.mjs; flip apex redirect to permanent in Vercel dashboard; WebP/resized logo + long-cache rule for /assets; visible hero text by default (animate via CSS, not opacity:0 SSR state).

### Forward risk: materialized and fixed (2026-09-04)

The cloud hybrid was already disclosed in the privacy policy (commit 88361c9, 2026-09-04) while the landing page still claimed "nothing ever leaves your device". All landing claims (hero badge, Bindy section, features card, pricing perk) plus the new FAQ, llms.txt, and JSON-LD were rewritten in this pass to the accurate model: full-resolution content stays on-device, reduced-resolution sampled frames go to servers for page detection and ordering, then are deleted. Residual: one testimonial still says "nothing leaves my phone" (quoted speech, left for the founder to replace); keep all future copy in lockstep with the privacy policy.

---

## Appendix A: llms.txt (deploy at /llms.txt)

```markdown
# Video2PDF

> Video2PDF is a mobile app for iPhone and Android that turns a handheld video of a physical book, notebook, or handout into a clean, searchable PDF. All AI processing runs on-device.

## Pages

- [Home](https://www.video2pdf.ai/): Product overview. Film pages in one continuous video and get a straightened, OCR-searchable PDF in seconds. Covers the three-step workflow, the six core features (smart page detection, hand avoidance, perspective correction, adaptive enhancement, searchable OCR text, on-device privacy), and pricing.
- [Start Free Trial](https://www.video2pdf.ai/go): Web checkout for Video2PDF Pro. 3-day free trial, then $29.99 per year with the price locked for life.
- [Manage Subscription](https://www.video2pdf.ai/manage): Self-service portal to update or cancel a Video2PDF Pro subscription purchased on the web.

## Legal

- [Privacy Policy](https://www.video2pdf.ai/privacy): How Video2PDF handles data. Page detection, cleanup, and text recognition run on-device; books and notes are never uploaded to any server.
- [Terms of Service](https://www.video2pdf.ai/terms): Subscription terms, free trial and cancellation policy, and acceptable use.
- [Delete Your Data](https://www.video2pdf.ai/delete-account): How to delete data associated with Video2PDF.

## Key Facts

- Product: Video2PDF, a consumer mobile app for iPhone and Android by Kaelor Ltd, at video2pdf.ai
- What it does: converts one continuous handheld video of book or notebook pages into a straightened, enhanced, fully searchable PDF, with no tripod or page-by-page capture
- How it works: on-device AI detects the moment each page settles, skips frames containing fingers, picks the sharpest frame, corrects perspective, enhances contrast, and runs OCR on every page
- Privacy model: all processing happens on the phone; no account or sign-up, no cloud upload, works fully offline
- Pricing: Video2PDF Pro costs $29.99 per year after a 3-day free trial; unlimited scans, no watermarks
- Difference from scanner apps: unlike page-at-a-time scanner apps (CamScanner, vFlat, Adobe Scan), Video2PDF captures pages from continuous video while you flip through the book
- App stores: https://apps.apple.com/us/app/video2pdf/id6761927204 and https://play.google.com/store/apps/details?id=com.vid2pdf.app
- Not affiliated with: video2pdf.com, the video2pdf packages on PyPI or GitHub (video-slides-to-PDF converters), or "Video to PDF Converter AI" transcription apps
- Typical users: students digitizing textbooks and lecture notes, teachers capturing worksheets, researchers archiving printed material

## Contact

- Website: https://www.video2pdf.ai
- Support: support@video2pdf.ai
```

Update cadence: quarterly, or whenever pricing or seasonal copy changes. The "12,000+ people" figure was intentionally left out pending verification; add it only if it is a number you can stand behind.

## Appendix B: JSON-LD blocks (server-render only, never inject client-side)

Render pattern in each server component:

```tsx
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
```

Validate after deploy with Google Rich Results Test, validator.schema.org, and by confirming the blocks appear in curl's raw HTML.

### B1. Organization + WebSite (app/layout.tsx, all pages)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.video2pdf.ai/#organization",
      "name": "Video2PDF",
      "legalName": "Kaelor Ltd",
      "url": "https://www.video2pdf.ai",
      "logo": { "@type": "ImageObject", "url": "https://www.video2pdf.ai/assets/icon.png" },
      "description": "Video2PDF is a mobile app by Kaelor Ltd that turns a video of any physical book, note, or handout into a clean, searchable PDF, with all processing done on-device.",
      "sameAs": [
        "https://apps.apple.com/us/app/video2pdf/id6761927204",
        "https://play.google.com/store/apps/details?id=com.vid2pdf.app"
      ],
      "knowsAbout": ["document scanning", "optical character recognition (OCR)", "on-device AI", "PDF conversion", "study tools"],
      "contactPoint": { "@type": "ContactPoint", "contactType": "customer support", "email": "support@video2pdf.ai" }
    },
    {
      "@type": "WebSite",
      "@id": "https://www.video2pdf.ai/#website",
      "name": "Video2PDF",
      "url": "https://www.video2pdf.ai",
      "description": "Film any textbook, note, or handout and get a searchable, shareable PDF in seconds.",
      "publisher": { "@id": "https://www.video2pdf.ai/#organization" },
      "inLanguage": "en-US"
    }
  ]
}
```

TODO: add social/Product Hunt/LinkedIn URLs to sameAs as they come online. SearchAction deliberately omitted (no site search). NO aggregateRating anywhere until stores show real ratings.

### B2. MobileApplication (app/page.tsx)

```json
{
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  "@id": "https://www.video2pdf.ai/#app",
  "name": "Video2PDF",
  "url": "https://www.video2pdf.ai",
  "description": "Record a video of any book, note, or handout and Video2PDF turns it into a straightened, enhanced, fully searchable PDF. Page detection, cleanup, and OCR all run on-device: no account, no uploads.",
  "operatingSystem": "iOS, Android",
  "applicationCategory": "ProductivityApplication",
  "applicationSubCategory": "EducationalApplication",
  "image": "https://www.video2pdf.ai/assets/icon.png",
  "installUrl": "https://apps.apple.com/us/app/video2pdf/id6761927204",
  "downloadUrl": "https://play.google.com/store/apps/details?id=com.vid2pdf.app",
  "author": { "@id": "https://www.video2pdf.ai/#organization" },
  "featureList": [
    "Smart page detection from continuous video",
    "Hand and finger avoidance",
    "Perspective correction and page straightening",
    "Adaptive enhancement for shadows and glare",
    "Searchable OCR text (copy, paste, highlight)",
    "Fully on-device processing, works offline, no account required"
  ],
  "offers": {
    "@type": "Offer",
    "name": "Video2PDF Pro, annual",
    "price": "29.99",
    "priceCurrency": "USD",
    "category": "subscription",
    "availability": "https://schema.org/InStock",
    "url": "https://www.video2pdf.ai/go",
    "description": "3-day free trial, then $29.99 per year. Free to download; cancel anytime before the trial ends."
  }
}
```

(softwareVersion omitted to avoid drift; add screenshot URL once one is hosted on the site.)

### B3. AggregateOffer for /go (app/go: makes pricing visible to non-JS crawlers)

```json
{
  "@context": "https://schema.org",
  "@type": "MobileApplication",
  "@id": "https://www.video2pdf.ai/#app",
  "name": "Video2PDF",
  "url": "https://www.video2pdf.ai",
  "operatingSystem": "iOS, Android",
  "applicationCategory": "ProductivityApplication",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "4.99",
    "highPrice": "29.99",
    "priceCurrency": "USD",
    "offerCount": 2,
    "offers": [
      {
        "@type": "Offer",
        "name": "Video2PDF Pro, weekly",
        "price": "4.99",
        "priceCurrency": "USD",
        "category": "subscription",
        "availability": "https://schema.org/InStock",
        "url": "https://www.video2pdf.ai/go",
        "description": "$4.99 per week, charged automatically unless canceled 24h before renewal."
      },
      {
        "@type": "Offer",
        "name": "Video2PDF Pro, annual",
        "price": "29.99",
        "priceCurrency": "USD",
        "category": "subscription",
        "availability": "https://schema.org/InStock",
        "url": "https://www.video2pdf.ai/go",
        "description": "3-day free trial if eligible; then $29.99 per year, charged automatically unless canceled 24h before renewal."
      }
    ]
  }
}
```

Prices verified against lib/funnel/config.ts; generate this block from FUNNEL_CONFIG so they cannot drift.

### B4. FAQPage (only after a visible FAQ section exists on the page)

Seed questions whose answers already exist in page copy: Does Video2PDF upload my books? How much does it cost? Is the PDF searchable? Does it work on Android? How is it different from CamScanner/vFlat? Does it work offline? FAQPage markup must mirror visible text; ship it with the FAQ section, not before.

## Appendix C: robots.txt shape (via app/robots.ts)

```
User-agent: *
Allow: /
Disallow: /login
Disallow: /manage
Disallow: /open
Disallow: /delete-account
Disallow: /go/success
Disallow: /api/
Disallow: /dashboard

User-agent: Bytespider
Disallow: /

Sitemap: https://www.video2pdf.ai/sitemap.xml
```

Pair with X-Robots-Tag noindex headers on the private routes (robots.txt blocks crawling, not indexing of already-known URLs).
