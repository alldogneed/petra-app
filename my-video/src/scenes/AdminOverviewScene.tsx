// src/scenes/AdminOverviewScene.tsx
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

const STATS = [
  { value: "3",       label: "חברי צוות פעילים", color: "#2563eb" },
  { value: "48",      label: "לקוחות",             color: "#16a34a" },
  { value: "6",       label: "תורים היום",          color: "#ea580c" },
  { value: "₪12,450", label: "הכנסות החודש",       color: "#d97706" },
];

const ACTIVITY = [
  { name: "דני", action: "הוסיף לקוח",    time: "לפני 3 דק׳",  color: "#2563eb" },
  { name: "שרה", action: "קבע תור",       time: "לפני 12 דק׳", color: "#7c3aed" },
  { name: "מיכל", action: "יצר הזמנה",   time: "לפני 28 דק׳", color: "#0891b2" },
  { name: "דני", action: "שלח תזכורת",   time: "לפני 45 דק׳", color: "#2563eb" },
];

export const AdminOverviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);
  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

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
        <AdminTabBar activeTab="סקירה" />

        <div style={{ padding: "20px 24px", overflow: "hidden" }}>
          {/* 4 stat cards in a row */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {STATS.map((stat, i) => {
              const startFrame = 25 + i * 20;
              const cardP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const cardY = interpolate(cardP, [0, 1], [24, 0]);
              const cardOpacity = interpolate(frame, [startFrame, startFrame + 14], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={stat.label} style={{
                  flex: 1,
                  background: "white", borderRadius: 12, padding: "16px 14px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  opacity: cardOpacity, transform: `translateY(${cardY}px)`,
                  borderTop: `3px solid ${stat.color}`,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 4 }}>{stat.label}</div>
                </div>
              );
            })}
          </div>

          {/* Activity feed */}
          <div style={{
            background: "white", borderRadius: 12,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>פעילות אחרונה</span>
            </div>
            {ACTIVITY.map((item, i) => {
              const startFrame = 80 + i * 18;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowY = interpolate(rowP, [0, 1], [20, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 14], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 18px", borderBottom: i < ACTIVITY.length - 1 ? "1px solid #f8fafc" : "none",
                  opacity: rowOpacity, transform: `translateY(${rowY}px)`,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: item.color, color: "white",
                    fontSize: 13, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {item.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>{item.name}</span>
                    <span style={{ fontSize: 13, color: "#64748b", marginRight: 6 }}>{item.action}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{item.time}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
