import { sql } from "@/lib/db/client";
import { mapSocialAccount } from "./map";
import type { AccountKind, Platform, SocialAccount } from "@/lib/content/types";

// Social account reads and writes.
//
// Token columns are never selected by these functions. The publishing adapters
// read them through their own narrow query (lib/content/publishers/tokens.ts),
// so an encrypted token cannot reach a dashboard payload by accident. The `sql`
// helper parameterises every interpolation, so column lists stay literal.

export async function listAccounts(kind?: AccountKind): Promise<SocialAccount[]> {
  const result = kind
    ? await sql`
        SELECT id, platform, kind, handle, display_name, platform_account_id,
               angle, needs_reconnect, active, created_at, updated_at
        FROM social_accounts
        WHERE kind = ${kind}
        ORDER BY platform, handle
      `
    : await sql`
        SELECT id, platform, kind, handle, display_name, platform_account_id,
               angle, needs_reconnect, active, created_at, updated_at
        FROM social_accounts
        ORDER BY kind, platform, handle
      `;
  return result.rows.map(mapSocialAccount);
}

export async function getAccount(id: number): Promise<SocialAccount | null> {
  const result = await sql`
    SELECT id, platform, kind, handle, display_name, platform_account_id,
           angle, needs_reconnect, active, created_at, updated_at
    FROM social_accounts
    WHERE id = ${id}
  `;
  const row = result.rows[0];
  return row ? mapSocialAccount(row) : null;
}

export interface AddAccountInput {
  platform: Platform;
  kind: AccountKind;
  handle: string;
  displayName?: string | null;
  angle?: string | null;
}

// Handles are stored without a leading @ and lowercased, so the same account
// added as "@Foo" and "foo" collides on the (platform, handle) unique index
// instead of being watched twice.
export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

export async function addAccount(input: AddAccountInput): Promise<SocialAccount> {
  const handle = normalizeHandle(input.handle);
  const result = await sql`
    INSERT INTO social_accounts (platform, kind, handle, display_name, angle)
    VALUES (${input.platform}, ${input.kind}, ${handle},
            ${input.displayName ?? null}, ${input.angle ?? null})
    ON CONFLICT (platform, handle) DO UPDATE SET
      display_name = COALESCE(EXCLUDED.display_name, social_accounts.display_name),
      angle = COALESCE(EXCLUDED.angle, social_accounts.angle),
      active = true,
      updated_at = now()
    RETURNING id, platform, kind, handle, display_name, platform_account_id,
              angle, needs_reconnect, active, created_at, updated_at
  `;
  return mapSocialAccount(result.rows[0]);
}

export async function setAccountActive(id: number, active: boolean): Promise<void> {
  await sql`
    UPDATE social_accounts SET active = ${active}, updated_at = now()
    WHERE id = ${id}
  `;
}

export async function removeAccount(id: number): Promise<void> {
  await sql`DELETE FROM social_accounts WHERE id = ${id}`;
}
