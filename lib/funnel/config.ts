export const FUNNEL_CONFIG = {
  socialProofCount: 12000,
  deepLinkScheme: "video2pdf://",
  plans: {
    weekly: { price: "$4.99", cents: 499, trialDays: 3, interval: "week" as const },
    annual: { price: "$29.99", cents: 2999, trialDays: 0, interval: "year" as const },
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
