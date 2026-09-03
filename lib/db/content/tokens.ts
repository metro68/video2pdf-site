import { sql } from "@/lib/db/client";
import { decryptToken, encryptToken } from "@/lib/content/crypto";

// The only module that reads or writes OAuth token columns. Keeping it separate
// from lib/db/content/accounts.ts is deliberate: the account queries never
// select these columns, so a token cannot reach a dashboard payload by way of
// a SELECT *.

export interface AccountTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

export async function saveTokens(
  accountId: number,
  tokens: { accessToken: string; refreshToken?: string | null; expiresAt?: Date | null },
): Promise<void> {
  await sql`
    UPDATE social_accounts
    SET access_token_encrypted = ${encryptToken(tokens.accessToken)},
        refresh_token_encrypted = ${
          tokens.refreshToken ? encryptToken(tokens.refreshToken) : null
        },
        token_expires_at = ${tokens.expiresAt ?? null},
        needs_reconnect = false,
        updated_at = now()
    WHERE id = ${accountId}
  `;
}

export async function readTokens(accountId: number): Promise<AccountTokens | null> {
  const result = await sql<{
    access_token_encrypted: string | null;
    refresh_token_encrypted: string | null;
    token_expires_at: Date | null;
  }>`
    SELECT access_token_encrypted, refresh_token_encrypted, token_expires_at
    FROM social_accounts WHERE id = ${accountId}
  `;
  const row = result.rows[0];
  if (!row?.access_token_encrypted) return null;

  try {
    return {
      accessToken: decryptToken(row.access_token_encrypted),
      refreshToken: row.refresh_token_encrypted
        ? decryptToken(row.refresh_token_encrypted)
        : null,
      expiresAt: row.token_expires_at ? row.token_expires_at.getTime() : null,
    };
  } catch {
    // A token that will not decrypt (rotated key, corrupted row) is treated as
    // missing, so the caller shows "Reconnect account" rather than throwing.
    return null;
  }
}

/** Flags an account whose credentials the platform rejected, so the UI can
 *  prompt a reconnect and the scheduler stops queueing jobs against it. */
export async function markNeedsReconnect(accountId: number): Promise<void> {
  await sql`
    UPDATE social_accounts SET needs_reconnect = true, updated_at = now()
    WHERE id = ${accountId}
  `;
}
