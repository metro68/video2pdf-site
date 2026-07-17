// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import { verifyCredentials, signSession, verifySession } from "@/lib/auth";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
  process.env.ADMIN_EMAIL = "admin@video2pdf.ai";
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("adminpass", 10);
  process.env.MARKETING_EMAIL = "marketing@video2pdf.ai";
  process.env.MARKETING_PASSWORD_HASH = bcrypt.hashSync("mktpass", 10);
});

describe("auth", () => {
  it("verifies admin credentials and assigns the admin role", async () => {
    const s = await verifyCredentials("admin@video2pdf.ai", "adminpass");
    expect(s).toEqual({ email: "admin@video2pdf.ai", role: "admin" });
  });

  it("verifies marketing credentials and assigns the marketing role", async () => {
    const s = await verifyCredentials("marketing@video2pdf.ai", "mktpass");
    expect(s?.role).toBe("marketing");
  });

  it("rejects a wrong password", async () => {
    const s = await verifyCredentials("admin@video2pdf.ai", "wrong");
    expect(s).toBeNull();
  });

  it("rejects an unknown email", async () => {
    const s = await verifyCredentials("nobody@video2pdf.ai", "x");
    expect(s).toBeNull();
  });

  it("signs and verifies a session round-trip", async () => {
    const token = await signSession({ email: "admin@video2pdf.ai", role: "admin" });
    const payload = await verifySession(token);
    expect(payload).toEqual({ email: "admin@video2pdf.ai", role: "admin" });
  });

  it("rejects a tampered token", async () => {
    const token = await signSession({ email: "admin@video2pdf.ai", role: "admin" });
    expect(await verifySession(token + "tamper")).toBeNull();
  });
});
