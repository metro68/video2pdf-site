import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/types";

// Edge-safe session module: JWT sign/verify via jose only, no Node-only deps
// (bcrypt lives in lib/auth). middleware.ts imports from here so its Edge
// bundle stays clean.

export const SESSION_COOKIE = "v2p_session";

export interface SessionPayload {
  email: string;
  role: Role;
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const email = payload.email;
    const role = payload.role;
    if (typeof email !== "string") return null;
    if (role !== "admin" && role !== "marketing") return null;
    return { email, role };
  } catch {
    return null;
  }
}
