// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { clearCache } from "@/lib/cache";
import * as appstore from "@/lib/connectors/appstore";
import * as posthog from "@/lib/connectors/posthog";
import * as meta from "@/lib/connectors/meta";

const ALL_ENV = [
  "APPSTORE_KEY_ID", "APPSTORE_ISSUER_ID", "APPSTORE_PRIVATE_KEY", "APPSTORE_VENDOR_NUMBER",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "GOOGLE_PLAY_PACKAGE_NAME",
  "POSTHOG_API_KEY", "POSTHOG_HOST", "POSTHOG_PROJECT_ID",
  "APPSFLYER_API_TOKEN", "APPSFLYER_APP_ID",
  "META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID",
  "TIKTOK_ACCESS_TOKEN", "TIKTOK_ADVERTISER_ID",
];

beforeEach(() => {
  clearCache();
  for (const k of ALL_ENV) delete process.env[k];
});

describe("connectors: awaiting-credentials path", () => {
  it("appstore returns awaiting_credentials with no keys", async () => {
    const r = await appstore.fetchMetrics();
    expect(r.status).toBe("awaiting_credentials");
    expect(r.data).toBeNull();
    expect(r.asOf).toBeNull();
  });

  it("posthog returns awaiting_credentials with no keys", async () => {
    const r = await posthog.fetchMetrics();
    expect(r.status).toBe("awaiting_credentials");
  });
});

describe("connectors: normalize", () => {
  it("meta.normalize maps spend and roas from a raw insights row", () => {
    const raw = { data: [{ spend: "120.50", purchase_roas: [{ value: "3.2" }], impressions: "1000", clicks: "40" }] };
    const m = meta.normalize(raw);
    expect(m.adSpend).toBeCloseTo(120.5);
    expect(m.roas).toBeCloseTo(3.2);
  });

  it("posthog.normalize maps dau from a trends result", () => {
    const raw = { result: [{ data: [10, 20, 30], count: 60 }] };
    const m = posthog.normalize(raw);
    expect(m.dau).toBe(30);
  });
});
