/** @type {import('next').NextConfig} */

// Transactional and account pages: crawlable URLs but never indexable.
// robots.txt disallows crawling; this header de-indexes URLs engines already know.
const NOINDEX_PATHS = [
  "/login",
  "/manage",
  "/open",
  "/delete-account",
  "/go/success",
  "/dashboard/:path*",
];

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  reactStrictMode: true,
  // A stray package-lock.json in the home directory otherwise makes Turbopack
  // guess the wrong workspace root.
  turbopack: { root: import.meta.dirname },
  async headers() {
    return [
      {
        // Apple fetches this extensionless file and requires JSON content type.
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      {
        // Keep the *.vercel.app mirror of production out of search and AI
        // indexes; only www.video2pdf.ai should accumulate citations.
        source: "/(.*)",
        has: [{ type: "host", value: "(?<host>.*\\.vercel\\.app)" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      ...NOINDEX_PATHS.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      {
        // Immutable-ish marketing assets; icons and mascot art change rarely.
        source: "/assets/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
};

export default nextConfig;
