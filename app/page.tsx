"use client";

export default function HomePage() {
  return (
    <>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        html {
          scroll-behavior: smooth;
        }
        body {
          line-height: 1.6;
          overflow-x: hidden;
        }

        /* Nav */
        nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          background: rgba(15, 23, 42, 0.85);
          border-bottom: 1px solid var(--border);
        }
        .nav-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: var(--text);
          font-weight: 700;
          font-size: 20px;
        }
        .logo-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          object-fit: cover;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        .nav-links {
          display: flex;
          gap: 32px;
          align-items: center;
        }
        .nav-links a {
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 15px;
          transition: color 0.2s;
        }
        .nav-links a:hover {
          color: var(--text);
        }
        .nav-cta {
          background: var(--primary);
          color: #fff !important;
          padding: 8px 18px;
          border-radius: 10px;
          font-weight: 600;
        }
        .nav-cta:hover {
          background: var(--primary-dark);
        }

        /* Hero */
        .hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          padding: 120px 24px 80px;
          overflow: hidden;
        }
        .hero::before {
          content: "";
          position: absolute;
          top: -20%;
          left: 50%;
          transform: translateX(-50%);
          width: 900px;
          height: 900px;
          background: radial-gradient(circle, rgba(13, 148, 136, 0.18) 0%, transparent 60%);
          pointer-events: none;
        }
        .hero-inner {
          position: relative;
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 48px;
          align-items: center;
        }
        .hero-copy {
          max-width: 560px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(13, 148, 136, 0.15);
          border: 1px solid rgba(13, 148, 136, 0.3);
          border-radius: 999px;
          padding: 6px 16px;
          font-size: 14px;
          color: var(--primary-light);
          margin-bottom: 24px;
        }
        .hero h1 {
          font-size: clamp(38px, 5.5vw, 60px);
          font-weight: 800;
          line-height: 1.08;
          margin-bottom: 20px;
          letter-spacing: -0.02em;
        }
        .hero h1 span {
          background: linear-gradient(135deg, var(--primary-light) 0%, var(--primary) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .hero p.sub {
          font-size: 19px;
          color: var(--text-secondary);
          margin-bottom: 32px;
        }
        .store-buttons {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }
        .get-app-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          border-radius: 14px;
          padding: 16px 44px;
          color: #fff;
          font-size: 17px;
          font-weight: 700;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(13, 148, 136, 0.25);
        }
        .get-app-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(13, 148, 136, 0.4);
        }
        .platform-note {
          margin-top: 14px;
          font-size: 14px;
          color: var(--text-secondary);
        }
        .hero-note {
          margin-top: 8px;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .hero-art {
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .hero-art img {
          width: 100%;
          max-width: 380px;
          height: auto;
          filter: drop-shadow(0 24px 48px rgba(0, 0, 0, 0.5));
          animation: float 5s ease-in-out infinite;
        }
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-14px);
          }
        }

        /* Section shells */
        .section {
          max-width: 1100px;
          margin: 0 auto;
          padding: 100px 24px;
        }
        .section-title {
          text-align: center;
          font-size: clamp(30px, 4vw, 40px);
          font-weight: 800;
          margin-bottom: 12px;
          letter-spacing: -0.01em;
        }
        .section-subtitle {
          text-align: center;
          color: var(--text-secondary);
          font-size: 18px;
          margin: 0 auto 60px;
          max-width: 560px;
        }

        /* How It Works */
        .steps {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 24px;
        }
        .step {
          position: relative;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 36px 24px;
          text-align: center;
          transition: border-color 0.2s, transform 0.2s;
        }
        .step:hover {
          border-color: var(--primary);
          transform: translateY(-4px);
        }
        .step-number {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--primary-light));
          color: white;
          font-weight: 700;
          font-size: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }
        .step .emoji {
          font-size: 28px;
          margin-bottom: 8px;
        }
        .step h3 {
          margin-bottom: 8px;
          font-size: 18px;
        }
        .step p {
          color: var(--text-secondary);
          font-size: 15px;
        }

        /* Meet Bindy */
        .meet {
          background: var(--bg-alt);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .meet-inner {
          max-width: 1000px;
          margin: 0 auto;
          padding: 90px 24px;
          display: grid;
          grid-template-columns: 0.8fr 1.2fr;
          gap: 48px;
          align-items: center;
        }
        .meet-art {
          display: flex;
          justify-content: center;
        }
        .meet-art img {
          width: 100%;
          max-width: 300px;
          height: auto;
          filter: drop-shadow(0 16px 32px rgba(0, 0, 0, 0.45));
        }
        .meet-copy h2 {
          font-size: clamp(28px, 3.5vw, 36px);
          font-weight: 800;
          margin-bottom: 16px;
          letter-spacing: -0.01em;
        }
        .meet-copy h2 span {
          color: var(--primary-light);
        }
        .meet-copy p {
          color: var(--text-secondary);
          font-size: 17px;
          margin-bottom: 16px;
        }

        /* Features */
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }
        .feature {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 28px;
          transition: border-color 0.2s, transform 0.2s;
        }
        .feature:hover {
          border-color: var(--primary);
          transform: translateY(-4px);
        }
        .feature-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          margin-bottom: 16px;
        }
        .feature h3 {
          margin-bottom: 8px;
          font-size: 17px;
        }
        .feature p {
          color: var(--text-secondary);
          font-size: 15px;
        }

        /* Pricing */
        .pricing-wrap {
          max-width: 460px;
          margin: 0 auto;
        }
        .pricing-card {
          background: var(--bg-card);
          border: 1px solid var(--pro);
          border-radius: 24px;
          padding: 40px 32px;
          position: relative;
          box-shadow: 0 0 50px rgba(124, 58, 237, 0.18);
        }
        .pricing-card::before {
          content: "3-DAY FREE TRIAL";
          position: absolute;
          top: -13px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--pro);
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 5px 18px;
          border-radius: 999px;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }
        .pricing-card h3 {
          font-size: 22px;
          margin-bottom: 4px;
          text-align: center;
        }
        .pricing-card .price {
          font-size: 44px;
          font-weight: 800;
          margin: 12px 0 2px;
          text-align: center;
        }
        .pricing-card .price small {
          font-size: 18px;
          font-weight: 400;
          color: var(--text-secondary);
        }
        .pricing-card .period {
          color: var(--text-secondary);
          font-size: 14px;
          margin-bottom: 28px;
          text-align: center;
        }
        .pricing-card ul {
          list-style: none;
          margin-bottom: 28px;
        }
        .pricing-card li {
          padding: 8px 0;
          font-size: 15px;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pricing-card li::before {
          content: "\\2713";
          color: var(--primary-light);
          font-weight: 700;
        }
        .cta-btn {
          display: block;
          width: 100%;
          padding: 15px 0;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          text-align: center;
          text-decoration: none;
          transition: all 0.2s;
          background: linear-gradient(135deg, var(--pro), #9333ea);
          color: white;
        }
        .cta-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(124, 58, 237, 0.35);
        }
        .pricing-fine {
          text-align: center;
          color: var(--text-secondary);
          font-size: 13px;
          margin-top: 18px;
        }

        /* Footer */
        footer {
          border-top: 1px solid var(--border);
          padding: 48px 24px;
          text-align: center;
        }
        .footer-inner {
          max-width: 1100px;
          margin: 0 auto;
        }
        .footer-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
          font-weight: 700;
        }
        .footer-brand img {
          width: 28px;
          height: 28px;
          border-radius: 8px;
        }
        .footer-links {
          display: flex;
          gap: 24px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .footer-links a {
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
        }
        .footer-links a:hover {
          color: var(--text);
        }
        .footer-copy {
          color: var(--text-secondary);
          font-size: 13px;
        }

        /* Responsive */
        @media (max-width: 860px) {
          .hero-inner {
            grid-template-columns: 1fr;
            text-align: center;
            gap: 32px;
          }
          .hero-copy {
            max-width: 620px;
            margin: 0 auto;
            order: 2;
          }
          .hero-art {
            order: 1;
          }
          .hero-art img {
            max-width: 260px;
          }
          .store-buttons {
            justify-content: center;
          }
          .meet-inner {
            grid-template-columns: 1fr;
            text-align: center;
            gap: 28px;
          }
          .meet-art {
            order: 1;
          }
          .meet-copy {
            order: 2;
          }
        }
        @media (max-width: 640px) {
          .nav-links a:not(.nav-cta) {
            display: none;
          }
          .store-buttons {
            flex-direction: column;
            align-items: center;
          }
          .get-app-btn {
            width: 100%;
            max-width: 300px;
            justify-content: center;
          }
        }
      `}</style>

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
            <a href="https://video2pdf.onelink.me/sWaT/xqzyhwkx" className="nav-cta">
              Get the App
            </a>
          </div>
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
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <a href="mailto:support@video2pdf.ai">Support</a>
          </div>
          <p className="footer-copy">© 2026 Video2PDF. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
