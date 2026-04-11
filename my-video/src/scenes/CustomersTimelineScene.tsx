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

const EVENTS = [
  { color: "#3b82f6", bg: "#eff6ff", title: "לקוח נוסף", desc: "דנה לוי נוספה למערכת", date: "5.4.2026 09:14", delay: 20 },
  { color: "#8b5cf6", bg: "#f5f3ff", title: "תור נקבע", desc: "אילוף פרטי — מיקי, ראשון 7.4 בשעה 10:00", date: "5.4.2026 09:18", delay: 50 },
  { color: ORANGE, bg: "#fff7ed", title: "חיה נוספה", desc: "מיקי — גולדן רטריבר, זכר, גיל 2", date: "5.4.2026 09:20", delay: 80 },
  { color: "#22c55e", bg: "#f0fdf4", title: "תשלום התקבל", desc: "הזמנה #1042 — ₪480 שולמו", date: "7.4.2026 11:32", delay: 110 },
  { color: "#22c55e", bg: "#f0fdf4", title: "וואטסאפ נשלח", desc: "תזכורת לתור מחר בשעה 10:00", date: "6.4.2026 09:00", delay: 138 },
];

export const CustomersTimelineScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });

  // Summary badge
  const summaryOpacity = interpolate(frame, [155, 170], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="לקוחות" />

      <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 8, opacity: headerOpacity }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>לקוחות</span>
          <span style={{ color: "#94a3b8" }}>›</span>
          <span style={{ color: "#64748b", fontSize: 12 }}>דנה לוי</span>
          <span style={{ color: "#94a3b8" }}>›</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>ציר זמן</span>
        </div>

        <div style={{ flex: 1, display: "flex", gap: 24, padding: "20px 32px" }}>
          {/* Timeline */}
          <div style={{ flex: 1, position: "relative" }}>
            {EVENTS.map((event) => {
              const eOpacity = interpolate(frame, [event.delay, event.delay + 15], [0, 1], { extrapolateRight: "clamp" });
              const eX = interpolate(
                spring({ frame: frame - event.delay, fps, config: { damping: 200 } }),
                [0, 1],
                [-16, 0]
              );
              return (
                <div
                  key={event.title + event.date}
                  style={{
                    marginBottom: 16,
                    opacity: eOpacity,
                    transform: `translateX(${eX}px)`,
                  }}
                >
                  {/* Content */}
                  <div
                    style={{
                      flex: 1,
                      background: "white",
                      borderRadius: 10,
                      padding: "12px 16px",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{event.title}</span>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{event.date}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{event.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: summary card */}
          <div style={{ width: 220, opacity: summaryOpacity, alignSelf: "flex-start" }}>
            <div
              style={{
                background: "linear-gradient(135deg, #0f172a, #1e293b)",
                borderRadius: 14,
                padding: "20px",
                color: "white",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "#fb923c" }}>סיכום פעילות</div>
              {[
                { label: "אירועים מוקלטים", value: "5" },
                { label: "תורים", value: "2" },
                { label: "תשלומים", value: "1" },
                { label: "הודעות", value: "1" },
              ].map((s) => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{s.value}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 12, marginTop: 4, fontSize: 12, color: "#fb923c", fontWeight: 600, textAlign: "center" }}>
                שום פרט לא הולך לאיבוד
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
