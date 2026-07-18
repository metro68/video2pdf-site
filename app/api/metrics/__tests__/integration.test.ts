// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { clearCache, setCached } from "@/lib/cache";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { GET as appstoreGet } from "@/app/api/metrics/appstore/route";
import { SESSION_COOKIE } from "@/lib/auth";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
  process.env.MARKETING_EMAIL = "marketing@video2pdf.ai";
  process.env.MARKETING_PASSWORD_HASH = bcrypt.hashSync("mktpass", 10);
  process.env.APPSTORE_KEY_ID = "x";
  process.env.APPSTORE_ISSUER_ID = "x";
  process.env.APPSTORE_PRIVATE_KEY = "x";
  process.env.APPSTORE_VENDOR_NUMBER = "x";
});

beforeEach(() => {
  clearCache();
  setCached(`connector:appstore:${new Date().toISOString().slice(0, 7)}`, { downloads: 42, mrr: 999, arr: 11988 });
});

function cookieFromSetCookie(setCookie: string): string {
  return setCookie.split(";")[0];
}

describe("marketing end-to-end redaction", () => {
  it("logs in as marketing and gets a redacted appstore payload", async () => {
    const loginRes = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "marketing@video2pdf.ai", password: "mktpass" }),
      }),
    );
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);

    const metricsRes = await appstoreGet(
      new Request("http://localhost/api/metrics/appstore", {
        headers: { cookie: cookieFromSetCookie(setCookie) },
      }),
    );
    const json = await metricsRes.json();
    expect(json.data.downloads).toBe(42);
    expect(json.data).not.toHaveProperty("mrr");
    expect(json.data).not.toHaveProperty("arr");
  });
});
