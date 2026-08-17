export type PixelEvent =
  | "PageView"
  | "ViewContent"
  | "Lead"
  | "InitiateCheckout"
  | "StartTrial"
  | "Purchase";

// TikTok's standard event vocabulary differs from Meta's. Anything not listed
// here has the same name on both networks (PageView, ViewContent, Lead).
// TikTok has no StartTrial, so a trial start is reported as Subscribe, which is
// the closest standard event its optimizer understands.
const TIKTOK_EVENT_NAMES: Partial<Record<PixelEvent, string>> = {
  InitiateCheckout: "InitiateCheckout",
  StartTrial: "Subscribe",
  Purchase: "CompletePayment",
};

function getFbq(): ((...args: unknown[]) => void) | undefined {
  const fbq = (globalThis as { fbq?: (...args: unknown[]) => void }).fbq;
  return typeof fbq === "function" ? fbq : undefined;
}

function getTtq(): { track?: (...args: unknown[]) => void; page?: () => void } | undefined {
  const ttq = (globalThis as { ttq?: { track?: unknown; page?: unknown } }).ttq;
  return ttq && typeof ttq === "object" ? (ttq as { track?: (...args: unknown[]) => void }) : undefined;
}

/**
 * Fires a standard conversion event on every configured pixel. Each network is
 * guarded independently so a missing or blocked SDK never stops the other from
 * reporting. `eventId` is passed to both so their server-side twins (Meta CAPI,
 * TikTok Events API) dedup against the browser event.
 */
export function track(event: PixelEvent, params?: Record<string, unknown>, eventId?: string): void {
  const fbq = getFbq();
  if (fbq) {
    if (eventId) {
      fbq("track", event, params ?? {}, { eventID: eventId });
    } else if (params) {
      fbq("track", event, params);
    } else {
      fbq("track", event);
    }
  }

  // PageView is emitted by ttq.page(), not ttq.track, so it is routed there.
  const ttq = getTtq();
  if (ttq) {
    if (event === "PageView") {
      ttq.page?.();
    } else if (typeof ttq.track === "function") {
      const name = TIKTOK_EVENT_NAMES[event] ?? event;
      ttq.track(name, params ?? {}, eventId ? { event_id: eventId } : {});
    }
  }
}

/**
 * Reports a route change to Meta only. Each network's PageView is owned by its
 * own pixel component, so neither double-counts the other's navigations.
 */
export function trackMetaPageView(): void {
  getFbq()?.("track", "PageView");
}

/**
 * Reports a route change to TikTok only. The base snippet already fires
 * ttq.page() on load, so callers skip the first render to avoid counting the
 * initial pageview twice.
 */
export function trackTikTokPageView(): void {
  getTtq()?.page?.();
}

/**
 * Fires a non-standard funnel event. Meta takes these via trackCustom; TikTok
 * accepts arbitrary names through its normal track call.
 */
export function trackCustom(name: string, params?: Record<string, unknown>): void {
  const fbq = getFbq();
  if (fbq) fbq("trackCustom", name, params ?? {});

  const ttq = getTtq();
  if (ttq && typeof ttq.track === "function") ttq.track(name, params ?? {});
}

/**
 * Attaches the visitor's email to the TikTok pixel so subsequent browser events
 * carry an identity signal. TikTok's SDK hashes it client-side before sending.
 */
export function identify(email: string): void {
  const ttq = (globalThis as { ttq?: { identify?: (payload: Record<string, string>) => void } }).ttq;
  if (ttq && typeof ttq.identify === "function") {
    ttq.identify({ email: email.trim().toLowerCase() });
  }
}
