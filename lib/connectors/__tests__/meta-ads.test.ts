// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import { clearCache } from "@/lib/cache";
import { normalizeAdInsights, fetchAdInsights } from "@/lib/connectors/meta";

beforeEach(() => {
  clearCache();
  delete process.env.META_ACCESS_TOKEN;
  delete process.env.META_AD_ACCOUNT_ID;
});

const RAW = {
  data: [
    {
      ad_id: "120210000001",
      ad_name: "UgcM- vid 2",
      date_start: "2026-08-12",
      date_stop: "2026-08-12",
      spend: "7.50",
      impressions: "455",
      inline_link_clicks: "8",
      actions: [
        { action_type: "offsite_conversion.fb_pixel_view_content", value: "6" },
        { action_type: "offsite_conversion.fb_pixel_lead", value: "3" },
        { action_type: "offsite_conversion.fb_pixel_initiate_checkout", value: "2" },
        { action_type: "offsite_conversion.custom.start_trial_website", value: "1" },
        { action_type: "offsite_conversion.custom.funnel_email_step_viewed", value: "4" },
        { action_type: "post_engagement", value: "12" },
      ],
    },
  ],
};

describe("normalizeAdInsights", () => {
  it("maps a raw row to an AdDailyRow with funnel counts", () => {
    const rows = normalizeAdInsights(RAW);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.adId).toBe("120210000001");
    expect(r.date).toBe("2026-08-12");
    expect(r.spend).toBeCloseTo(7.5);
    expect(r.clicks).toBe(8);
    expect(r.contentViews).toBe(6);
    expect(r.leads).toBe(3);
    expect(r.checkouts).toBe(2);
    expect(r.trials).toBe(1);
    expect(r.emailStepViews).toBe(4);
  });

  it("returns empty for missing or malformed payloads", () => {
    expect(normalizeAdInsights(null)).toEqual([]);
    expect(normalizeAdInsights({})).toEqual([]);
    expect(normalizeAdInsights({ data: [{}] })).toHaveLength(1); // zeros, not a crash
  });

  it("does not double-count duplicate/aggregate action_type buckets for the same conversion", () => {
    // Live accounts report one underlying conversion under several
    // action_type values at once (bare, "omni_*", "onsite_web_*", and the
    // canonical "offsite_conversion.fb_pixel_*"). Only the pixel-specific
    // bucket should be counted.
    const raw = {
      data: [
        {
          ad_id: "1",
          ad_name: "dup-test",
          date_start: "2026-08-13",
          spend: "1",
          impressions: "1",
          inline_link_clicks: "1",
          actions: [
            { action_type: "view_content", value: "5" },
            { action_type: "omni_view_content", value: "5" },
            { action_type: "onsite_web_view_content", value: "5" },
            { action_type: "onsite_web_app_view_content", value: "5" },
            { action_type: "offsite_conversion.fb_pixel_view_content", value: "5" },
            { action_type: "initiate_checkout", value: "2" },
            { action_type: "onsite_web_initiate_checkout", value: "2" },
            { action_type: "offsite_initiate_checkout_add_20_s_calls", value: "2" },
            { action_type: "offsite_conversion.fb_pixel_initiate_checkout", value: "2" },
          ],
        },
      ],
    };
    const rows = normalizeAdInsights(raw);
    expect(rows[0].contentViews).toBe(5);
    expect(rows[0].checkouts).toBe(2);
  });
});

describe("fetchAdInsights", () => {
  it("returns awaiting_credentials without env", async () => {
    const r = await fetchAdInsights();
    expect(r.status).toBe("awaiting_credentials");
    expect(r.data).toBeNull();
  });
});
