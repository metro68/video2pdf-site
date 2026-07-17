"use client";

export default function DeleteAccountPage() {
  return (
    <>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          line-height: 1.7;
        }
        .container {
          max-width: 720px;
          margin: 0 auto;
          padding: 80px 24px 60px;
        }
        a.back {
          color: var(--primary);
          font-size: 14px;
          text-decoration: none;
          display: inline-block;
          margin-bottom: 24px;
        }
        a.back:hover {
          text-decoration: underline;
        }
        .legal h1 {
          font-size: 32px;
          margin-bottom: 8px;
        }
        .updated {
          color: var(--text-secondary);
          font-size: 14px;
          margin-bottom: 32px;
        }
        .legal h2 {
          font-size: 20px;
          margin: 32px 0 12px;
        }
        .legal p,
        .legal ul {
          color: var(--text-secondary);
          margin-bottom: 16px;
        }
        .legal ul {
          padding-left: 20px;
        }
        .legal li {
          margin-bottom: 6px;
        }
        .legal a.inline {
          color: var(--primary);
        }
      `}</style>

      <div className="container legal">
        <a className="back" href="/">
          ← Back to Video2PDF
        </a>
        <h1>Delete Your Data</h1>
        <p className="updated">Last updated: July 17, 2026</p>

        <p>
          Video2PDF does not require an account. There is no sign-up, no login, and no personal
          profile stored on our servers. Because of that, there is no account to delete. This page
          explains how to remove the data that does exist and how to request deletion of the limited
          analytics and advertising-measurement data associated with your device.
        </p>

        <h2>Your documents and scans</h2>
        <p>
          Every video, page image, and generated PDF is processed and stored only on your device. To
          remove this data, delete the individual documents inside the app, or uninstall Video2PDF.
          Uninstalling removes all locally stored scans, images, and PDFs from your device.
        </p>

        <h2>Your subscription</h2>
        <p>
          Subscriptions are managed by Apple or Google, not by Video2PDF. To cancel, use your
          device's subscription settings:
        </p>
        <ul>
          <li>
            iPhone: Settings, tap your name, then Subscriptions, then Video2PDF, then Cancel
            Subscription.
          </li>
          <li>
            Android: open Google Play, tap your profile, then Payments and subscriptions, then
            Subscriptions, then Video2PDF, then Cancel.
          </li>
        </ul>

        <h2>Analytics and advertising data</h2>
        <p>
          We collect a random device identifier and, with your permission, an advertising identifier
          to measure app performance and advertising. To request deletion of any analytics or
          advertising-measurement data associated with your device, email us at{" "}
          <a className="inline" href="mailto:support@video2pdf.ai">
            support@video2pdf.ai
          </a>{" "}
          with the subject line "Data deletion request." We will process your request within 30 days.
          You can also stop this collection at any time by turning off tracking in your device
          settings, as described in our{" "}
          <a className="inline" href="/privacy">
            Privacy Policy
          </a>
          .
        </p>

        <h2>Contact</h2>
        <p>
          Questions about your data? Email{" "}
          <a className="inline" href="mailto:support@video2pdf.ai">
            support@video2pdf.ai
          </a>
          .
        </p>
      </div>
    </>
  );
}
