import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/jsonld";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/go`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/how-to-scan-a-book`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/alternatives`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
