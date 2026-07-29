/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeAll } from "vitest";
import { SignJWT } from "jose";
import { signManageToken, verifyManageToken } from "@/lib/manage/token";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
});

describe("manage token", () => {
  it("round-trips subscriptionId and email", async () => {
    const token = await signManageToken({ subscriptionId: "sub_1", email: "a@b.c" });
    expect(await verifyManageToken(token)).toEqual({
      subscriptionId: "sub_1",
      email: "a@b.c",
    });
  });

  it("rejects a tampered token", async () => {
    const token = await signManageToken({ subscriptionId: "sub_1", email: "a@b.c" });
    expect(await verifyManageToken(token.slice(0, -2) + "xx")).toBeNull();
  });

  it("rejects a JWT without the manage scope", async () => {
    const rogue = await new SignJWT({ email: "a@b.c", role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30m")
      .sign(new TextEncoder().encode("test-secret"));
    expect(await verifyManageToken(rogue)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({ subscriptionId: "sub_1", email: "a@b.c", scope: "manage" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode("test-secret"));
    expect(await verifyManageToken(expired)).toBeNull();
  });
});
