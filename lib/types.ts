export type Role = "admin" | "marketing";

export interface Metrics {
  downloads?: number;
  dau?: number;
  paidSubs?: number;
  arpu?: number;
  churnRate?: number;
  mrr?: number;
  arr?: number;
  adSpend?: number;
  roas?: number;
  [key: string]: unknown;
}
