const GO_URL = "https://www.video2pdf.ai/go?src=email_reminder";

function reminderHtml(unsubscribeUrl: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <p style="font-size: 16px; line-height: 1.5;">Hi there,</p>
      <p style="font-size: 16px; line-height: 1.5;">
        It's Bindy the bookworm here. I noticed you started setting up Video2PDF but
        did not finish, so I saved your spot.
      </p>
      <p style="font-size: 16px; line-height: 1.5;">
        Your 3-day free trial is still waiting, then it's just $29.99 a year to turn
        every video, scan, and note into a clean, searchable PDF.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${GO_URL}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block;">
          Finish setting up
        </a>
      </div>
      <p style="font-size: 14px; line-height: 1.5; color: #555555;">
        See you inside,<br />Bindy
      </p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0 16px;" />
      <p style="font-size: 12px; color: #888888;">
        <a href="${unsubscribeUrl}" style="color: #888888;">Unsubscribe</a> from these reminders.
      </p>
    </div>
  `.trim();
}

// Reads env inside the function so test-time env stubs are honored and so a
// missing key at call time is handled gracefully instead of throwing at import.
export async function sendReminderEmail(email: string, unsubscribeUrl: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your free trial is waiting",
        html: reminderHtml(unsubscribeUrl),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
