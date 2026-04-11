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

// Animation phases:
// 0-40: Order details appear (left panel)
// 55-80: Arrow animates
// 70-110: Auto-stay panel appears (right panel)
// 120+: "שובץ אוטומטית" badge glows

const ORDER_FIELDS = [
  { label: "לקוח", value: "ענבל כהן" },
  { label: "כלב", value: "בובו — לברדור, 3 שנים" },
  { label: "שירות", value: "פנסיון" },
  { label: "כניסה", value: "10/04/2026 — 10:00" },
  { label: "יציאה", value: "13/04/2026 — 10:00" },
  { label: "חדר מועדף", value: "חדר גדול" },
  { label: "סה״כ", value: "₪450" },
];

export const BoardingAutoStayScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(frame, [20, 40], [0, 3], { extrapolateRight: "clamp" });

  // Order panel
  const orderP = spring({ frame: frame - 25, fps, config: { damping: 200 } });
  const orderX = interpolate(orderP, [0, 1], [-30, 0]);
  const orderOpacity = interpolate(frame, [25, 40], [0, 1], { extrapolateRight: "clamp" });

  // Arrow
  const arrowP = spring({ frame: frame - 55, fps, config: { damping: 200 } });
  const arrowScale = interpolate(arrowP, [0, 1], [0.3, 1]);
  const arrowOpacity = interpolate(frame, [55, 68], [0, 1], { extrapolateRight: "clamp" });

  // Stay panel
  const stayP = spring({ frame: frame - 72, fps, config: { damping: 200 } });
  const stayX = interpolate(stayP, [0, 1], [30, 0]);
  const stayOpacity = interpolate(frame, [72, 85], [0, 1], { extrapolateRight: "clamp" });

  // Badge glow
  const badgeGlowP = interpolate(frame, [120, 155], [0, 1], { extrapolateRight: "clamp" });
  const badgeGlow = interpolate(badgeGlowP, [0, 0.5, 1], [0, 1, 0]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
        <PetraSidebar width={SIDEBAR_W} activeLabel="פנסיון" />
      </div>

      {/* Main content */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0 }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>שיבוץ אוטומטי מהזמנה</div>
          <div style={{
            fontSize: 11, fontWeight: 700,
            background: "#fff7ed", color: ORANGE,
            border: "1px solid #fed7aa", borderRadius: 8, padding: "4px 12px",
          }}>
            הזמנת פנסיון חדשה
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 24, padding: "28px 24px", height: "calc(100% - 52px)",
        }}>

          {/* Order card */}
          <div style={{
            background: "white", borderRadius: 14, border: "1px solid #e2e8f0",
            padding: "20px 24px", flex: 1, maxWidth: 300,
            opacity: orderOpacity, transform: `translateX(${orderX}px)`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE }} />
              הזמנה חדשה
            </div>
            {ORDER_FIELDS.map((f, i) => {
              const fOpacity = interpolate(frame, [30 + i * 6, 40 + i * 6], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, opacity: fOpacity }}>
                  <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{f.label}</span>
                  <span style={{ fontSize: 11, color: "#1e293b", fontWeight: 700 }}>{f.value}</span>
                </div>
              );
            })}
          </div>

          {/* Arrow */}
          <div style={{
            opacity: arrowOpacity, transform: `scale(${arrowScale})`,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}>
            <div style={{ fontSize: 28, color: ORANGE }}>←</div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: ORANGE,
              background: "#fff7ed", border: "1px solid #fed7aa",
              borderRadius: 6, padding: "4px 8px", textAlign: "center", whiteSpace: "nowrap",
            }}>שיבוץ<br />אוטומטי</div>
          </div>

          {/* Auto stay card */}
          <div style={{
            background: "white", borderRadius: 14, border: "2px solid #22c55e",
            padding: "20px 24px", flex: 1, maxWidth: 300,
            opacity: stayOpacity, transform: `translateX(${stayX}px)`,
            boxShadow: `0 2px 12px rgba(34,197,94,0.15)`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
              שהייה בפנסיון — נוצרה אוטומטית
            </div>

            {[
              { label: "כלב", value: "בובו" },
              { label: "חדר", value: "חדר 3 (גדול)" },
              { label: "כניסה", value: "10/04/2026" },
              { label: "יציאה", value: "13/04/2026" },
              { label: "לילות", value: "3" },
            ].map((f, i) => {
              const fOpacity = interpolate(frame, [76 + i * 6, 86 + i * 6], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={f.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, opacity: fOpacity }}>
                  <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{f.label}</span>
                  <span style={{ fontSize: 11, color: "#1e293b", fontWeight: 700 }}>{f.value}</span>
                </div>
              );
            })}

            {/* Badge */}
            <div style={{
              marginTop: 14,
              background: badgeGlow > 0.05 ? `rgba(34,197,94,${0.1 + badgeGlow * 0.15})` : "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: 8, padding: "8px 12px",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: badgeGlow > 0.05 ? `0 0 20px rgba(34,197,94,${badgeGlow * 0.4})` : "none",
              opacity: stayOpacity,
            }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>שובץ אוטומטית — ממתין לאישור צ׳ק אין</span>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
