export type PixelEvent = "PageView" | "ViewContent" | "Lead" | "InitiateCheckout" | "Purchase";

export function track(event: PixelEvent, params?: Record<string, unknown>, eventId?: string): void {
  const fbq = (globalThis as { fbq?: (...args: unknown[]) => void }).fbq;
  if (typeof fbq !== "function") return;
  if (eventId) {
    fbq("track", event, params ?? {}, { eventID: eventId });
  } else if (params) {
    fbq("track", event, params);
  } else {
    fbq("track", event);
  }
}
