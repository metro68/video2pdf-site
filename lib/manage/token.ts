import { SignJWT, jwtVerify } from "jose";

// Short-lived token binding the /manage flow to one subscription. Signed with the
// same JWT_SECRET as dashboard sessions but carries scope:"manage" (and no role),
// so the two token kinds are mutually unusable.

export interface ManageTokenPayload {
  subscriptionId: string;
  email: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signManageToken(p: ManageTokenPayload): Promise<string> {
  return new SignJWT({ subscriptionId: p.subscriptionId, email: p.email, scope: "manage" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(secretKey());
}

export async function verifyManageToken(
  token: string,
): Promise<ManageTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.scope !== "manage") return null;
    if (typeof payload.subscriptionId !== "string") return null;
    if (typeof payload.email !== "string") return null;
    return { subscriptionId: payload.subscriptionId, email: payload.email };
  } catch {
    return null;
  }
}
