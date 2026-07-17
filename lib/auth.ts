import bcrypt from "bcryptjs";
import type { Role } from "@/lib/types";
import type { SessionPayload } from "@/lib/session";

// Re-export the Edge-safe session pieces so existing importers of "@/lib/auth"
// keep working. bcrypt (Node-only) stays here; anything that must run on the
// Edge runtime (middleware) should import from "@/lib/session" directly.
export { SESSION_COOKIE, signSession, verifySession } from "@/lib/session";
export type { SessionPayload } from "@/lib/session";

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

export async function verifyCredentials(email: string, password: string): Promise<SessionPayload | null> {
  const user = seededUsers().find((u) => u.email && u.email.toLowerCase() === email.toLowerCase());
  if (!user || !user.hash) return null;
  const ok = await bcrypt.compare(password, user.hash);
  if (!ok) return null;
  return { email: user.email as string, role: user.role };
}
