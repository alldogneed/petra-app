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

const CHECKIN_FRAME = 120;

const NOTES = [
  "תזונה מיוחדת — יבש בלבד",
  "תרופה: ריבוקסיל — פעם ביום בצהריים",
  "חרד מרעשים — להרחיק מחדרים רועשים",
];

export const BoardingCheckinScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(frame, [20, 38], [0, 3], { extrapolateRight: "clamp" });

  const cardP = spring({ frame: frame - 28, fps, config: { damping: 200 } });
  const cardY = interpolate(cardP, [0, 1], [16, 0]);
  const cardOpacity = interpolate(frame, [28, 42], [0, 1], { extrapolateRight: "clamp" });

  // Check-in button state
  const checkedIn = frame >= CHECKIN_FRAME;
  const checkInP = spring({ frame: frame - CHECKIN_FRAME, fps, config: { damping: 200 } });
  const checkInScale = interpolate(checkInP, [0, 1], [0.9, 1]);
  const checkGlowP = interpolate(frame, [CHECKIN_FRAME, CHECKIN_FRAME + 18], [0, 1], { extrapolateRight: "clamp" });
  const checkGlow = interpolate(checkGlowP, [0, 0.5, 1], [0, 1, 0]);

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
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>פנסיון — חדר 3</div>
          <div style={{
            fontSize: 11, fontWeight: 700,
            background: "#eff6ff", color: "#3b82f6",
            border: "1px solid #bfdbfe", borderRadius: 8, padding: "4px 12px",
          }}>
            תפוס
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "20px 24px", display: "flex", gap: 20 }}>

          {/* Stay card */}
          <div style={{
            background: "white", borderRadius: 14, border: "1px solid #e2e8f0",
            padding: "20px", flex: 1,
            opacity: cardOpacity, transform: `translateY(${cardY}px)`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
          }}>
            {/* Dog info */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: "linear-gradient(135deg, #fb923c, #ea580c)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, color: "white", fontWeight: 700,
              }}>ב</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>בובו</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>לברדור · 3 שנים</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>ענבל כהן</div>
              </div>
            </div>

            {/* Dates */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              {[
                { label: "כניסה", value: "10/04", time: "10:00" },
                { label: "יציאה", value: "13/04", time: "10:00" },
                { label: "לילות", value: "3", time: "" },
              ].map((d) => (
                <div key={d.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600, marginBottom: 3 }}>{d.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>{d.value}</div>
                  {d.time && <div style={{ fontSize: 9, color: "#64748b" }}>{d.time}</div>}
                </div>
              ))}
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 8 }}>הערות טיפול</div>
              {NOTES.map((note, i) => {
                const noteOpacity = interpolate(frame, [50 + i * 14, 65 + i * 14], [0, 1], { extrapolateRight: "clamp" });
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 7,
                    background: "#fafafa", borderRadius: 8, padding: "7px 10px",
                    marginBottom: 6, border: "1px solid #f1f5f9",
                    opacity: noteOpacity, fontSize: 11, color: "#475569",
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: ORANGE, marginTop: 4, flexShrink: 0 }} />
                    {note}
                  </div>
                );
              })}
            </div>

            {/* Check-in button */}
            <div
              style={{
                borderRadius: 10, padding: "11px 0",
                background: checkedIn
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
                color: "white", fontSize: 13, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                transform: checkedIn ? `scale(${checkInScale})` : "scale(1)",
                boxShadow: checkedIn
                  ? `0 4px 20px rgba(34,197,94,${0.3 + checkGlow * 0.4})`
                  : `0 4px 16px rgba(234,88,12,0.3)`,
                cursor: "pointer",
              }}
            >
              {checkedIn ? (
                <>
                  <span style={{ fontSize: 16 }}>✓</span>
                  צ׳ק אין בוצע — 10/04 10:23
                </>
              ) : (
                "אשר צ׳ק אין"
              )}
            </div>
          </div>

          {/* Quick stats sidebar */}
          <div style={{ width: 180, display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { label: "סטטוס", value: checkedIn ? "בפנסיון ✓" : "ממתין לכניסה", color: checkedIn ? "#16a34a" : "#d97706", bg: checkedIn ? "#f0fdf4" : "#fffbeb" },
              { label: "חדר", value: "חדר 3", color: "#3b82f6", bg: "#eff6ff" },
              { label: "תשלום", value: "₪450 — שולם", color: "#10b981", bg: "#ecfdf5" },
            ].map((s, i) => {
              const sOpacity = interpolate(frame, [35 + i * 12, 48 + i * 12], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={s.label} style={{
                  background: s.bg, borderRadius: 10, border: `1px solid ${s.color}33`,
                  padding: "12px 14px", opacity: sOpacity,
                }}>
                  <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
