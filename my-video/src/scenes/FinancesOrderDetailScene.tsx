import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const ORANGE = "#ea580c";

export const FinancesOrderDetailScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const cardOpacity = interpolate(frame, [18, 32], [0, 1], { extrapolateRight: "clamp" });
  const itemsOpacity = interpolate(frame, [36, 50], [0, 1], { extrapolateRight: "clamp" });
  const totalsOpacity = interpolate(frame, [55, 68], [0, 1], { extrapolateRight: "clamp" });
  const btnHighlight = interpolate(frame, [90, 108], [0, 1], { extrapolateRight: "clamp" });

  const btnScale = interpolate(
    spring({ frame: frame - 90, fps, config: { damping: 200 } }),
    [0, 1],
    [0.9, 1]
  );

  const waOpacity = interpolate(frame, [110, 125], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="פיננסים" />

      <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Breadcrumb */}
        <div
          style={{
            background: "white",
            borderBottom: "1px solid #e2e8f0",
            padding: "0 28px",
            height: 50,
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: headerOpacity,
          }}
        >
          <span style={{ color: "#64748b", fontSize: 12 }}>הזמנות</span>
          <span style={{ color: "#94a3b8" }}>›</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>#FD226115</span>
        </div>

        <div style={{ flex: 1, overflow: "hidden", padding: "20px 28px" }}>
          {/* Order header card */}
          <div
            style={{
              background: "white",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              padding: "20px 24px",
              marginBottom: 16,
              opacity: cardOpacity,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    background: "#f0fdf4",
                    color: "#16a34a",
                    border: "1px solid #bbf7d0",
                    borderRadius: 20,
                    padding: "4px 10px",
                  }}
                >
                  ✓ הושלמה
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    background: "#fff7ed",
                    color: ORANGE,
                    border: `1px solid ${ORANGE}40`,
                    borderRadius: 20,
                    padding: "4px 10px",
                  }}
                >
                  אילוף
                </span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הזמנה #FD226115</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>לקוח</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: ORANGE }}>ספיר מזרחי</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>050-3333333</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>תאריך התחלה</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>22 במרץ 2026, 11:00</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>נוצר 20 במרץ 2026</div>
              </div>
            </div>
          </div>

          {/* Order items */}
          <div
            style={{
              background: "white",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
              marginBottom: 16,
              opacity: itemsOpacity,
            }}
          >
            <div
              style={{
                padding: "12px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>פריטי הזמנה</span>
              <span
                style={{
                  fontSize: 10,
                  background: "#f1f5f9",
                  color: "#64748b",
                  borderRadius: 99,
                  padding: "1px 7px",
                  fontWeight: 600,
                }}
              >
                1
              </span>
            </div>

            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 70px 90px 70px 90px",
                padding: "10px 20px",
                borderBottom: "1px solid #f1f5f9",
                background: "#fafafa",
              }}
            >
              {["שם", "יחידה", "כמות", "מחיר יחידה", "מע\"מ", "סה\"כ שורה"].map((h) => (
                <span key={h} style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textAlign: "right" }}>{h}</span>
              ))}
            </div>

            {/* Item row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 70px 90px 70px 90px",
                padding: "12px 20px",
                borderBottom: "1px solid #f1f5f9",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>אילוף בבית הלקוח</span>
              <span style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>לפגישה</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", textAlign: "right" }}>1</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", textAlign: "right" }}>₪400.00</span>
              <span style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>₪58.12</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", textAlign: "right" }}>₪400.00</span>
            </div>

            {/* Totals */}
            <div style={{ padding: "12px 20px", opacity: totalsOpacity }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#374151" }}>₪400.00</span>
                <span style={{ fontSize: 13, color: "#64748b" }}>סכום ביניים</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: "#374151" }}>₪58.12</span>
                <span style={{ fontSize: 13, color: "#64748b" }}>מע"מ</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: "2px solid #e2e8f0",
                  paddingTop: 10,
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 800, color: ORANGE }}>₪400.00</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>סה"כ לתשלום</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{
                opacity: totalsOpacity,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 12px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                fontSize: 12,
                color: "#ef4444",
                fontWeight: 600,
              }}
            >
              טרם שולם
            </div>

            <div style={{ marginRight: "auto", display: "flex", gap: 10 }}>
              <div
                style={{
                  opacity: Math.max(totalsOpacity, 0),
                  background: "white",
                  border: `1.5px solid ${ORANGE}`,
                  color: ORANGE,
                  borderRadius: 8,
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                }}
              >
                + רשום תשלום
              </div>

              <div
                style={{
                  opacity: btnHighlight,
                  transform: `scale(${btnScale})`,
                  background: "#16a34a",
                  color: "white",
                  borderRadius: 8,
                  padding: "10px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  boxShadow: `0 4px 16px rgba(22,163,74,${btnHighlight * 0.4})`,
                }}
              >
                דרישת תשלום בוואטסאפ
              </div>
            </div>
          </div>

          {/* WA hint */}
          <div
            style={{
              opacity: waOpacity,
              marginTop: 14,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 12,
              color: "#16a34a",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            פטרה תשלח את הקישור לדף התשלום ישירות לוואטסאפ של ספיר מזרחי
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
