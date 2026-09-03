import type { ConnectorResult } from "@/lib/connectors/types";
import type { Platform } from "@/lib/content/types";
import type { PublicCollector, PublicPost, PublicProfile } from "./types";

// Operator-entered collection: the v1 default.
//
// It fetches nothing. An operator records what they can see on a public profile
// or post, through the Trends view, and those readings are stored with
// source "manual". This is deliberately the shipping default: it needs no
// platform approval, no vendor contract, and carries no terms-of-service risk,
// while producing exactly the same shape of data a licensed provider would.
//
// Swapping in a real collector later means implementing PublicCollector and
// changing which one lib/content/collectors/index.ts returns. Nothing that
// reads snapshots needs to know which collector produced them.
export const manualCollector: PublicCollector = {
  source: "manual",
  label: "Manual entry",
  isConfigured: () => true,

  async fetchProfile(
    _platform: Platform,
    _handle: string,
  ): Promise<ConnectorResult<PublicProfile>> {
    return {
      data: null,
      asOf: null,
      status: "awaiting_credentials",
      error: "Manual collector: profile figures are entered by an operator.",
    };
  },

  async fetchRecentPosts(
    _platform: Platform,
    _handle: string,
  ): Promise<ConnectorResult<PublicPost[]>> {
    return {
      data: null,
      asOf: null,
      status: "awaiting_credentials",
      error: "Manual collector: post figures are entered by an operator.",
    };
  },
};
