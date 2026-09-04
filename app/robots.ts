import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/jsonld";

const PRIVATE_PATHS = [
  "/login",
  "/manage",
  "/open",
  "/delete-account",
  "/go/success",
  "/dashboard",
  "/api/",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      // Bytespider ignores crawl etiquette and feeds no answer surface we care about.
      { userAgent: "Bytespider", disallow: "/" },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
