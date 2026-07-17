// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import { POST } from "@/app/api/auth/login/route";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-1234567890";
  process.env.ADMIN_EMAIL = "admin@video2pdf.ai";
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("adminpass", 10);
});

function req(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  it("sets a session cookie on valid credentials", async () => {
    const res = await POST(req({ email: "admin@video2pdf.ai", password: "adminpass" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("v2p_session=");
    const json = await res.json();
    expect(json.role).toBe("admin");
  });

  it("returns 401 on a wrong password", async () => {
    const res = await POST(req({ email: "admin@video2pdf.ai", password: "wrong" }));
    expect(res.status).toBe(401);
  });
});
