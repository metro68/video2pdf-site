export const MANAGE_CONFIG = {
  // Trialing annual subscribers get the $0.99 offer too (their first paid year
  // becomes $0.99). Flip to false if redemption data shows trial gaming.
  offerToTrialing: true,
  winbackCouponId: "winback-annual-29",
  winbackAmountOffCents: 2900,
  pauseDays: 30,
  cancelReasons: [
    { id: "too_expensive", label: "Too expensive" },
    { id: "not_using", label: "Not using it enough" },
    { id: "missing_feature", label: "Missing a feature I need" },
    { id: "not_working", label: "Something's not working" },
    { id: "finished", label: "I finished what I needed it for" },
  ],
} as const;

export type CancelReasonId =
  | (typeof MANAGE_CONFIG.cancelReasons)[number]["id"]
  | "skipped";
