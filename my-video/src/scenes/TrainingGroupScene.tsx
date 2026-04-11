import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

export const TrainingGroupScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const bgOpacity = interpolate(frame, [12, 26], [0, 1], { extrapolateRight: "clamp" });

  // Modal opens mid-scene
  const modalProgress = spring({ frame: frame - 60, fps, config: { damping: 200 } });
  const modalY = interpolate(modalProgress, [0, 1], [30, 0]);
  const modalOpacity = interpolate(frame, [60, 75], [0, 1], { extrapolateRight: "clamp" });

  const field = (delay: number) => interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול תהליכי אילוף" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>אימונים וניהול כלבים</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>קבוצות ותוכניות אימון</div>
          </div>
          <div style={{
            background: ORANGE, color: "white", borderRadius: 8,
            padding: "7px 14px", fontSize: 12, fontWeight: 700,
          }}>
            + הוסף תהליך ידני
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          padding: "10px 24px 0", display: "flex", gap: 8,
          opacity: headerOpacity, flexShrink: 0,
        }}>
          {["סקירה", "אילוף בבית הלקוח", "אילוף בתנאי פנסיון", "אילוף קבוצתי", "ארכיון"].map((tab) => (
            <div key={tab} style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: tab === "אילוף קבוצתי" ? ORANGE : "white",
              color: tab === "אילוף קבוצתי" ? "white" : "#64748b",
              border: tab === "אילוף קבוצתי" ? "none" : "1px solid #e2e8f0",
            }}>
              {tab}
            </div>
          ))}
        </div>

        {/* Empty state */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 12, opacity: bgOpacity,
        }}>
          <div style={{ fontSize: 48, color: "#94a3b8" }}>👥</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#475569" }}>אין קבוצות אימון</div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>צור קבוצת אימון חדשה כדי להתחיל</div>
          <div style={{
            background: ORANGE, color: "white", borderRadius: 8,
            padding: "8px 18px", fontSize: 13, fontWeight: 700,
          }}>
            + קבוצה חדשה
          </div>
        </div>
      </div>

      {/* Modal overlay */}
      {modalOpacity > 0 && (
        <div style={{
          position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0,
          background: "rgba(15,23,42,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "white", borderRadius: 16,
            width: 440,
            padding: "24px 28px",
            opacity: modalOpacity,
            transform: `translateY(${modalY}px)`,
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            display: "flex", flexDirection: "column", gap: 14,
            direction: "rtl",
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>קבוצת אימון חדשה</div>

            {/* Name */}
            <div style={{ opacity: field(70) }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>שם הקבוצה *</div>
              <div style={{
                border: `2px solid ${ORANGE}`, borderRadius: 8, padding: "9px 12px",
                fontSize: 13, color: "#0f172a", fontWeight: 600, background: "#fff7ed",
              }}>
                קבוצת גורים — מחזור 3
              </div>
            </div>

            {/* Type */}
            <div style={{ opacity: field(82) }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>סוג</div>
              <div style={{
                border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px",
                fontSize: 13, color: "#0f172a", display: "flex", justifyContent: "space-between",
              }}>
                <span>מותאם אישית</span>
                <span style={{ color: "#94a3b8" }}>▾</span>
              </div>
            </div>

            {/* Day + Time */}
            <div style={{ display: "flex", gap: 12, opacity: field(94) }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>יום קבוע</div>
                <div style={{
                  border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px",
                  fontSize: 13, color: "#0f172a", display: "flex", justifyContent: "space-between",
                }}>
                  <span>יום שלישי</span>
                  <span style={{ color: "#94a3b8" }}>▾</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>שעה</div>
                <div style={{
                  border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px",
                  fontSize: 13, color: "#0f172a",
                }}>09:00</div>
              </div>
            </div>

            {/* Location + Max */}
            <div style={{ display: "flex", gap: 12, opacity: field(106) }}>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>מיקום</div>
                <div style={{
                  border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px",
                  fontSize: 13, color: "#0f172a",
                }}>גן ציבורי אחוזה</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>מקסימום משתתפים</div>
                <div style={{
                  border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px",
                  fontSize: 13, color: "#0f172a", fontWeight: 700,
                }}>6</div>
              </div>
            </div>

            {/* Create button */}
            <div style={{
              opacity: field(120),
              background: ORANGE, color: "white",
              borderRadius: 10, padding: "12px",
              fontSize: 14, fontWeight: 800, textAlign: "center",
              boxShadow: "0 4px 14px rgba(234,88,12,0.35)",
            }}>
              + צור קבוצה
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
