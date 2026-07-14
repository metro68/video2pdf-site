import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/types";

export const SESSION_COOKIE = "v2p_session";

export interface SessionPayload {
  email: string;
  role: Role;
}

interface SeededUser {
  email: string | undefined;
  hash: string | undefined;
  role: Role;
}

function seededUsers(): SeededUser[] {
  return [
    { email: process.env.ADMIN_EMAIL, hash: process.env.ADMIN_PASSWORD_HASH, role: "admin" },
    { email: process.env.MARKETING_EMAIL, hash: process.env.MARKETING_PASSWORD_HASH, role: "marketing" },
  ];
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function verifyCredentials(email: string, password: string): Promise<SessionPayload | null> {
  const user = seededUsers().find((u) => u.email && u.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.hash) return null;
  const ok = await bcrypt.compare(password, user.hash);
  if (!ok) return null;
  return { email: user.email as string, role: user.role };
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
