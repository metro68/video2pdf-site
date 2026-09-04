import { ImageResponse } from "next/og";

export const alt = "Video2PDF: film any book, get a searchable PDF";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Brand tokens mirrored from globals.css (@theme); next/og cannot read CSS.
const BG = "#0f172a";
const CARD = "#1e293b";
const BORDER = "#334155";
const PRIMARY = "#0d9488";
const PRIMARY_LIGHT = "#34d399";
const TEXT = "#f8fafc";
const MUTED = "#94a3b8";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          backgroundColor: BG,
          backgroundImage: `radial-gradient(48rem 24rem at 70% -10%, ${PRIMARY}33, transparent)`,
          color: TEXT,
          fontFamily: "-apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 44,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: PRIMARY,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: TEXT,
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            V2
          </div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>Video2PDF</div>
        </div>

        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: -2,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>Film any book.</span>
          <span style={{ color: PRIMARY_LIGHT }}>Get a searchable PDF.</span>
        </div>

        <div
          style={{
            marginTop: 36,
            fontSize: 30,
            color: MUTED,
            display: "flex",
          }}
        >
          Your books stay on your phone. No account required.
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 48 }}>
          {["Smart page detection", "OCR search", "iPhone and Android"].map(
            (label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "10px 22px",
                  borderRadius: 999,
                  backgroundColor: CARD,
                  border: `1px solid ${BORDER}`,
                  color: TEXT,
                  fontSize: 24,
                }}
              >
                {label}
              </div>
            ),
          )}
        </div>
      </div>
    ),
    size,
  );
}
