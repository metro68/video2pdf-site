// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import { sendReminderEmail } from "@/lib/email/resend";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ id: "email_1" }) });
  vi.stubGlobal("fetch", fetchMock);
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "Bindy at Video2PDF <hello@video2pdf.ai>";
});

describe("sendReminderEmail", () => {
  it("posts to the Resend API with the Bearer key, from address, and unsubscribe link", async () => {
    const ok = await sendReminderEmail("a@b.com", "https://www.video2pdf.ai/api/unsubscribe?e=a@b.com&t=abc");
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer re_test_key",
          "content-type": "application/json",
        }),
      }),
    );
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.from).toBe("Bindy at Video2PDF <hello@video2pdf.ai>");
    expect(body.to).toEqual(["a@b.com"]);
    expect(body.subject).toMatch(/trial/i);
    expect(body.html).toMatch(/https:\/\/www\.video2pdf\.ai\/api\/unsubscribe\?e=a@b\.com&t=abc/);
    expect(body.html).toMatch(/video2pdf\.ai\/go\?src=email_reminder/);
  });

  it("has no em dashes anywhere in the email copy", async () => {
    await sendReminderEmail("a@b.com", "https://example.com/unsub");
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.subject).not.toMatch(/—/);
    expect(body.html).not.toMatch(/—/);
  });

  it("returns false without throwing when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const ok = await sendReminderEmail("a@b.com", "https://example.com/unsub");
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns false without throwing when the Resend API call fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "bad request" }) });
    const ok = await sendReminderEmail("a@b.com", "https://example.com/unsub");
    expect(ok).toBe(false);
  });

  it("returns false without throwing when fetch itself throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const ok = await sendReminderEmail("a@b.com", "https://example.com/unsub");
    expect(ok).toBe(false);
  });
});
