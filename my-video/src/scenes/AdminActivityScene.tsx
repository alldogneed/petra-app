// src/scenes/AdminActivityScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { AdminTabBar } from "./AdminTabBar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

const ROWS = [
  { dot: "#16a34a", name: "דני כהן",       action: "הוסיף לקוח",     time: "לפני 3 דק׳" },
  { dot: "#2563eb", name: "שרה לוי",       action: "קבע תור",         time: "לפני 12 דק׳" },
  { dot: "#16a34a", name: "דני כהן",       action: "יצר הזמנה",      time: "לפני 28 דק׳" },
  { dot: "#dc2626", name: "מיכל ב׳",       action: "מחק תור",         time: "לפני 1 שע׳" },
  { dot: "#2563eb", name: "שרה לוי",       action: "עדכן הגדרות",    time: "לפני 2 שע׳" },
  { dot: "#16a34a", name: "דני כהן",       action: "הוסיף לקוח",     time: "לפני 3 שע׳" },
];

export const AdminActivityScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);
  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const filterOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });

  const calloutP = spring({ frame: frame - 260, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [20, 0]);
  const calloutOpacity = interpolate(frame, [260, 280], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול ובקרה" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", opacity: 0.6 + pulse * 0.4 }} />
            <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}>ניטור פעיל</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>ניהול ובקרה</div>
        </div>
        <AdminTabBar activeTab="פעילות" />

        <div style={{ padding: "16px 24px" }}>
          {/* Filters */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, opacity: filterOpacity }}>
            {["כל חברי הצוות ▾", "כל הפעולות ▾"].map((f) => (
              <div key={f} style={{
                background: "white", borderRadius: 8, padding: "8px 14px",
                fontSize: 12, fontWeight: 600, color: "#475569",
                border: "1px solid #e2e8f0",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}>
                {f}
              </div>
            ))}
          </div>

          {/* Activity table */}
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {ROWS.map((row, i) => {
              const startFrame = 35 + i * 22;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowY = interpolate(rowP, [0, 1], [18, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 14], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 18px", borderBottom: i < ROWS.length - 1 ? "1px solid #f8fafc" : "none",
                  opacity: rowOpacity, transform: `translateY(${rowY}px)`,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", minWidth: 90 }}>{row.name}</span>
                  <span style={{ fontSize: 13, color: "#475569", flex: 1 }}>{row.action}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{row.time}</span>
                </div>
              );
            })}
          </div>

          {/* Callout */}
          <div style={{
            marginTop: 14, background: "rgba(234,88,12,0.08)",
            border: "1px solid rgba(234,88,12,0.25)", borderRadius: 10, padding: "10px 16px",
            opacity: calloutOpacity, transform: `translateY(${calloutY}px)`,
          }}>
            <span style={{ fontSize: 12, color: "#ea580c", fontWeight: 600 }}>
              כל פעולה נשמרת — לא ניתן למחוק מהיסטוריית הפעילות
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
