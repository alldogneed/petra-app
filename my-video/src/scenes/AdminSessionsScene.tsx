// src/scenes/AdminSessionsScene.tsx
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

const SESSIONS = [
  { name: "דני כהן",         device: "iPhone",  ip: "212.143.xx.xx", online: true,  lastSeen: "אונליין עכשיו" },
  { name: "שרה לוי",         device: "Mac",     ip: "77.125.xx.xx",  online: true,  lastSeen: "לפני 2 דק׳" },
  { name: "מיכל ברנשטיין",  device: "Android", ip: "46.120.xx.xx",  online: false, lastSeen: "לפני 3 שע׳" },
  { name: "יוסי מזרחי",      device: "Windows", ip: "31.168.xx.xx",  online: false, lastSeen: "לפני יום" },
];

export const AdminSessionsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);
  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const calloutOpacity = interpolate(frame, [220, 240], [0, 1], { extrapolateRight: "clamp" });
  const calloutP = spring({ frame: frame - 220, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [20, 0]);

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
        <AdminTabBar activeTab="סשנים" />

        <div style={{ padding: "20px 24px" }}>
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "flex", padding: "10px 18px",
              borderBottom: "1px solid #f1f5f9", background: "#fafafa",
            }}>
              {["שם", "מכשיר", "כתובת IP", "סטטוס", ""].map((h) => (
                <div key={h} style={{ flex: h === "" ? "0 0 36px" : 1, fontSize: 11, fontWeight: 700, color: "#64748b" }}>{h}</div>
              ))}
            </div>

            {SESSIONS.map((session, i) => {
              const startFrame = 30 + i * 25;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowY = interpolate(rowP, [0, 1], [20, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 16], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={session.name} style={{
                  display: "flex", alignItems: "center", padding: "11px 18px",
                  borderBottom: i < SESSIONS.length - 1 ? "1px solid #f8fafc" : "none",
                  opacity: rowOpacity, transform: `translateY(${rowY}px)`,
                }}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{session.name}</div>
                  <div style={{ flex: 1, fontSize: 12, color: "#475569" }}>{session.device}</div>
                  <div style={{ flex: 1, fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{session.ip}</div>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: session.online ? "#22c55e" : "#94a3b8" }} />
                    <span style={{ fontSize: 12, color: "#64748b" }}>{session.lastSeen}</span>
                  </div>
                  <div style={{
                    flex: "0 0 36px",
                    width: 26, height: 26, borderRadius: "50%",
                    background: "#fee2e2", color: "#dc2626",
                    fontSize: 14, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer",
                  }}>×</div>
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
              ניתוק מרחוק — לחצו על × לניתוק מיידי של סשן חשוד
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
