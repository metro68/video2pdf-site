// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { signSession, SESSION_COOKIE } from "@/lib/auth";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
});

function reqFor(path: string, token?: string): NextRequest {
  const url = `http://localhost${path}`;
  const headers = new Headers();
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  return new NextRequest(url, { headers });
}

describe("proxy", () => {
  it("redirects an unauthenticated dashboard request to /login", async () => {
    const res = await proxy(reqFor("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("returns 401 for an unauthenticated metrics API request", async () => {
    const res = await proxy(reqFor("/api/metrics/appstore"));
    expect(res.status).toBe(401);
  });

  it("allows an authenticated dashboard request through", async () => {
    const token = await signSession({ email: "admin@video2pdf.ai", role: "admin" });
    const res = await proxy(reqFor("/dashboard", token));
    // NextResponse.next() has no redirect location and a 200 status.
    expect(res.headers.get("location")).toBeNull();
  });
});
