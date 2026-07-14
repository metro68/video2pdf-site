// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { clearCache } from "@/lib/cache";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
  // Provide appstore creds so it returns data (fetchRaw throws -> status error, but redaction still must apply to any data).
});

beforeEach(() => clearCache());

async function getWithRole(routePost: (r: Request) => Promise<Response>, role: "admin" | "marketing") {
  const token = await signSession({ email: "x@video2pdf.ai", role });
  const req = new Request("http://localhost/api/metrics/appstore", {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  });
  return routePost(req);
}

describe("metrics route redaction", () => {
  it("marketing never receives mrr or arr even when present in connector data", async () => {
    const { GET } = await import("@/app/api/metrics/appstore/route");
    // Force the connector to yield data with mrr/arr via a cache seed.
    const { setCached } = await import("@/lib/cache");
    process.env.APPSTORE_KEY_ID = "x";
    process.env.APPSTORE_ISSUER_ID = "x";
    process.env.APPSTORE_PRIVATE_KEY = "x";
    setCached("connector:appstore", { downloads: 10, mrr: 500, arr: 6000 });
    const res = await getWithRole(GET, "marketing");
    const json = await res.json();
    expect(json.data).not.toHaveProperty("mrr");
    expect(json.data).not.toHaveProperty("arr");
    expect(json.data.downloads).toBe(10);
  });

  it("admin receives mrr and arr", async () => {
    const { GET } = await import("@/app/api/metrics/appstore/route");
    const { setCached } = await import("@/lib/cache");
    process.env.APPSTORE_KEY_ID = "x";
    process.env.APPSTORE_ISSUER_ID = "x";
    process.env.APPSTORE_PRIVATE_KEY = "x";
    setCached("connector:appstore", { downloads: 10, mrr: 500, arr: 6000 });
    const res = await getWithRole(GET, "admin");
    const json = await res.json();
    expect(json.data.mrr).toBe(500);
    expect(json.data.arr).toBe(6000);
  });
});
