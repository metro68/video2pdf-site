// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

const sqlMock = vi.fn(async (..._a: unknown[]) => ({ rows: [] as unknown[] }));
vi.mock("@/lib/db/client", () => ({ sql: (...a: unknown[]) => sqlMock(...a) }));

const sendReminderEmail = vi.fn();
vi.mock("@/lib/email/resend", () => ({
  sendReminderEmail: (...a: unknown[]) => sendReminderEmail(...a),
}));

import { GET } from "@/app/api/cron/abandoned-emails/route";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://test/api/cron/abandoned-emails", { headers });
}

beforeEach(() => {
  sqlMock.mockReset().mockResolvedValue({ rows: [] });
  sendReminderEmail.mockReset().mockResolvedValue(true);
  process.env.CRON_SECRET = "test-cron-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.video2pdf.ai";
});

describe("GET /api/cron/abandoned-emails", () => {
  it("401s without the bearer token", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it("401s with the wrong bearer token", async () => {
    const res = await GET(req({ authorization: "Bearer wrong" }));
    expect(res.status).toBe(401);
  });

  it("sends reminders for eligible leads and stamps reminder_sent_at", async () => {
    sqlMock.mockImplementation(async (strings: unknown) => {
      const text = (strings as string[]).join("?");
      if (/SELECT/i.test(text)) {
        return { rows: [{ email: "a@b.com" }, { email: "c@d.com" }] };
      }
      return { rows: [] };
    });
    const res = await GET(req({ authorization: "Bearer test-cron-secret" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 2 });
    expect(sendReminderEmail).toHaveBeenCalledTimes(2);
    expect(sendReminderEmail).toHaveBeenCalledWith(
      "a@b.com",
      expect.stringMatching(/^https:\/\/www\.video2pdf\.ai\/api\/unsubscribe\?e=a%40b\.com&t=.+/),
    );
    const updateCalls = sqlMock.mock.calls.filter((c) =>
      (c[0] as unknown as string[]).join("?").match(/UPDATE leads/i),
    );
    expect(updateCalls.length).toBe(2);
  });

  it("does not stamp reminder_sent_at when the send fails", async () => {
    sqlMock.mockImplementation(async (strings: unknown) => {
      const text = (strings as string[]).join("?");
      if (/SELECT/i.test(text)) {
        return { rows: [{ email: "a@b.com" }] };
      }
      return { rows: [] };
    });
    sendReminderEmail.mockResolvedValue(false);
    const res = await GET(req({ authorization: "Bearer test-cron-secret" }));
    expect(await res.json()).toEqual({ sent: 0 });
    const updateCalls = sqlMock.mock.calls.filter((c) =>
      (c[0] as unknown as string[]).join("?").match(/UPDATE leads/i),
    );
    expect(updateCalls.length).toBe(0);
  });

  it("returns sent: 0 when there are no eligible leads", async () => {
    sqlMock.mockResolvedValue({ rows: [] });
    const res = await GET(req({ authorization: "Bearer test-cron-secret" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0 });
    expect(sendReminderEmail).not.toHaveBeenCalled();
  });

  it("the eligibility query excludes subscribed/reminded/unsubscribed leads and caps at 50", async () => {
    let selectQuery = "";
    sqlMock.mockImplementation(async (strings: unknown) => {
      const text = (strings as string[]).join("?");
      if (/SELECT/i.test(text)) {
        selectQuery = text;
        return { rows: [] };
      }
      return { rows: [] };
    });
    await GET(req({ authorization: "Bearer test-cron-secret" }));
    expect(selectQuery).toMatch(/reminder_sent_at IS NULL/i);
    expect(selectQuery).toMatch(/unsubscribed_at IS NULL/i);
    expect(selectQuery).toMatch(/interval '4 hours'/i);
    expect(selectQuery).toMatch(/interval '48 hours'/i);
    expect(selectQuery).toMatch(/NOT EXISTS/i);
    expect(selectQuery).toMatch(/LIMIT/i);
  });
});
