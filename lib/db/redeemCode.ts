import { randomInt } from "node:crypto";

// Human-friendly redeem code. Crockford-style alphabet with ambiguous characters
// removed (no 0/O, 1/I/L, U) so a code is easy to read off one screen and type on
// another device. Formatted as XXXX-XXXX. ~28^8 combinations, and codes are
// single-use, email-scoped, and expiring, so this is safe for a redemption
// fallback while staying typable. The deep link still carries this same code in
// its URL for the primary one-tap path.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateRedeemCode(): string {
  const pick = () => ALPHABET[randomInt(ALPHABET.length)];
  const group = () => Array.from({ length: 4 }, pick).join("");
  return `${group()}-${group()}`;
}
