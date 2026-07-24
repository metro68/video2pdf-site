"use client";

import { useState } from "react";

// Mobile burger menu for the homepage header. The header nav links are hidden on
// small screens, so without this a phone visitor cannot reach How It Works,
// Features, Pricing, or Manage Subscription. Kept as a small client component so
// the page itself stays a server component (no full-page "use client").
export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mobile-menu">
      <button
        type="button"
        className="mobile-menu-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="mobile-menu-bar" />
        <span className="mobile-menu-bar" />
        <span className="mobile-menu-bar" />
      </button>

      {open ? (
        <div className="mobile-menu-panel" role="menu">
          <a href="#how-it-works" onClick={() => setOpen(false)}>
            How It Works
          </a>
          <a href="#features" onClick={() => setOpen(false)}>
            Features
          </a>
          <a href="#pricing" onClick={() => setOpen(false)}>
            Pricing
          </a>
          <a href="/manage" onClick={() => setOpen(false)}>
            Manage Subscription
          </a>
          <a
            href="https://video2pdf.onelink.me/sWaT/xqzyhwkx"
            className="mobile-menu-cta"
            onClick={() => setOpen(false)}
          >
            Get the App
          </a>
        </div>
      ) : null}
    </div>
  );
}
