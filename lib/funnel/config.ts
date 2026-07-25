export const FUNNEL_CONFIG = {
  socialProofCount: 12000,
  deepLinkScheme: "video2pdf://",
  // AppsFlyer OneLink: routes to the right store per device, and carries the
  // redeem params through install for deferred deep linking.
  appStoreUrl: "https://video2pdf.onelink.me/sWaT/xqzyhwkx",
  // Our own universal-link host (AASA served by this site). Must differ from the
  // page's host (www) or iOS suppresses same-domain universal links.
  appLinkBase: "https://app.video2pdf.ai",
  plans: {
    weekly: { price: "$4.99", cents: 499, trialDays: 0, interval: "week" as const },
    annual: { price: "$29.99", cents: 2999, trialDays: 3, interval: "year" as const },
  },
  proBenefits: [
    "Full-resolution scans",
    "Searchable, copyable PDFs",
    "Unlimited documents",
  ],
} as const;

export function finePrint(price: string, trialDays: number): string {
  if (trialDays > 0) {
    return `${trialDays}-day free trial if eligible; then ${price}, charged automatically unless canceled 24h before renewal.`;
  }
  return `${price} charged automatically unless canceled 24h before renewal.`;
}
