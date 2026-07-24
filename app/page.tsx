import "./home.css";
import { MobileMenu } from "./components/MobileMenu";

export default function HomePage() {
  return (
    <>
      <nav>
        <div className="nav-inner">
          <a href="/" className="logo">
            <img src="/assets/icon.png" alt="Video2PDF logo" className="logo-icon" />
            Video2PDF
          </a>
          <div className="nav-links">
            <a href="#how-it-works">How It Works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="/manage">Manage</a>
            <a href="https://video2pdf.onelink.me/sWaT/xqzyhwkx" className="nav-cta">
              Get the App
            </a>
          </div>
          <MobileMenu />
        </div>
      </nav>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="badge">✨ AI-Powered Book Scanner</div>
            <h1>
              Film any book. Get a <span>searchable PDF</span>.
            </h1>
            <p className="sub">
              Stop retyping notes and snapping pages one by one. Just film a textbook, handout, or
              notebook. Video2PDF finds every page, straightens and cleans it, and builds a
              searchable, shareable PDF in seconds.
            </p>
            <div className="store-buttons">
              <a
                href="https://video2pdf.onelink.me/sWaT/xqzyhwkx"
                className="get-app-btn"
                id="get-app-link"
              >
                Get the App
              </a>
            </div>
            <p className="platform-note">Free on iPhone and Android</p>
            <p className="hero-note">Free for 3 days, then $29.99/year. Cancel anytime.</p>
          </div>
          <div className="hero-art">
            <img
              src="/assets/bindy.png"
              alt="Bindy, the Video2PDF bookworm mascot, reading an open book"
            />
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <h2 className="section-title">From video to PDF in three steps</h2>
        <p className="section-subtitle">
          No flat-lay, no tripod, no scanning each page. Just press record.
        </p>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="emoji">🎬</div>
            <h3>Film the pages</h3>
            <p>
              Point your camera and pan slowly across your book or notes. Flip pages as you go. One
              continuous video is all it takes.
            </p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <div className="emoji">🧠</div>
            <h3>Bindy does the work</h3>
            <p>
              On-device AI spots each page, avoids your hands, picks the sharpest frame, straightens
              the perspective, and enhances the text.
            </p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <div className="emoji">📄</div>
            <h3>Export your PDF</h3>
            <p>
              Review the pages, apply a filter, and share a clean, searchable PDF. Copy and paste the
              text straight out of it.
            </p>
          </div>
        </div>
      </section>

      <section className="meet">
        <div className="meet-inner">
          <div className="meet-art">
            <img src="/assets/bindy.png" alt="Bindy the bookworm mascot" />
          </div>
          <div className="meet-copy">
            <h2>
              Meet <span>Bindy</span>, your bookworm guide
            </h2>
            <p>
              Bindy is the friendly bookworm behind every scan. While you film, Bindy reads along,
              catching each page the moment it settles and turning your footage into crisp, readable
              pages.
            </p>
            <p>
              No accounts to set up and nothing uploaded to a server. Every scan is processed right
              on your device, so your books, notes, and documents never leave your phone.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <h2 className="section-title">Smart from capture to export</h2>
        <p className="section-subtitle">
          The intelligence that turns a shaky handheld video into a scanner-grade PDF.
        </p>
        <div className="features-grid">
          <div className="feature">
            <div className="feature-icon" style={{ background: "rgba(13, 148, 136, 0.15)" }}>
              🎯
            </div>
            <h3>Smart Page Detection</h3>
            <p>
              Optical-flow analysis catches the exact moment each page settles, so every capture is
              sharp, not mid-flip or blurred.
            </p>
          </div>
          <div className="feature">
            <div className="feature-icon" style={{ background: "rgba(124, 58, 237, 0.15)" }}>
              🖐️
            </div>
            <h3>Smart Hand Avoidance</h3>
            <p>
              The AI detects your fingers and picks frames where the page is fully visible and
              unobstructed.
            </p>
          </div>
          <div className="feature">
            <div className="feature-icon" style={{ background: "rgba(59, 130, 246, 0.15)" }}>
              📐
            </div>
            <h3>Perspective Correction</h3>
            <p>
              Tilted and skewed pages are automatically straightened into a flat, scanner-like
              result.
            </p>
          </div>
          <div className="feature">
            <div className="feature-icon" style={{ background: "rgba(245, 158, 11, 0.15)" }}>
              ✨
            </div>
            <h3>Adaptive Enhancement</h3>
            <p>
              Smart thresholding and auto-levels make text crisp and backgrounds clean, page after
              page.
            </p>
          </div>
          <div className="feature">
            <div className="feature-icon" style={{ background: "rgba(239, 68, 68, 0.15)" }}>
              🔍
            </div>
            <h3>Searchable OCR Text</h3>
            <p>
              Text is recognized on every page, so your PDFs are fully searchable and ready to copy
              and paste.
            </p>
          </div>
          <div className="feature">
            <div className="feature-icon" style={{ background: "rgba(16, 185, 129, 0.15)" }}>
              🔒
            </div>
            <h3>On-Device Privacy</h3>
            <p>
              Everything runs locally on your phone. No uploads, no cloud, no account. Your documents
              stay yours.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="pricing">
        <h2 className="section-title">One simple plan</h2>
        <p className="section-subtitle">
          Try every feature free for 3 days. Keep it for about $2.50 a month, billed yearly.
        </p>
        <div className="pricing-wrap">
          <div className="pricing-card">
            <h3>Video2PDF Pro</h3>
            <div className="price">
              $29.99 <small>/year</small>
            </div>
            <div className="period">Billed annually · 3-day free trial</div>
            <ul>
              <li>Unlimited scans and documents</li>
              <li>Full-resolution pages</li>
              <li>Searchable, copyable PDF text</li>
              <li>No watermarks</li>
              <li>Private on-device processing</li>
            </ul>
            <a href="https://video2pdf.onelink.me/sWaT/xqzyhwkx" className="cta-btn">
              Start Your Free Trial
            </a>
            <p className="pricing-fine">
              3 days free, then $29.99/year. Cancel anytime before the trial ends and you won&apos;t
              be charged.
            </p>
          </div>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-brand">
            <img src="/assets/icon.png" alt="Video2PDF logo" />
            Video2PDF
          </div>
          <div className="footer-links">
            <a href="/manage">Manage Subscription</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <a href="/delete-account">Delete Your Data</a>
            <a href="mailto:support@video2pdf.ai">Support</a>
          </div>
          <p className="footer-copy">© 2026 Video2PDF. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
