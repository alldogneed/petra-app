// src/scenes/AdminMessagesScene.tsx
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
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const EXISTING_MESSAGES = [
  { title: "עדכון מערכת", content: "המערכת תהיה בתחזוקה בין 01:00-03:00", status: "active" },
  { title: "חג שמח!",    content: "לרגל ראש השנה העסק יסגר מוקדם ב-16:00", status: "expired" },
];

export const AdminMessagesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);
  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const formP = spring({ frame: frame - 25, fps, config: { damping: 200 } });
  const formY = interpolate(formP, [0, 1], [24, 0]);
  const formOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: "clamp" });

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
        <AdminTabBar activeTab="הודעות מערכת" />

        <div style={{ padding: "16px 24px" }}>
          {/* Add button */}
          <div style={{
            display: "flex", justifyContent: "flex-start", marginBottom: 14,
            opacity: formOpacity,
          }}>
            <div style={{
              background: ORANGE, color: "white",
              fontSize: 13, fontWeight: 700,
              padding: "8px 18px", borderRadius: 8,
              boxShadow: "0 2px 8px rgba(234,88,12,0.3)",
            }}>
              + הוסף הודעה
            </div>
          </div>

          {/* Creation form */}
          <div style={{
            background: "white", borderRadius: 12,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            padding: "18px", marginBottom: 16,
            opacity: formOpacity, transform: `translateY(${formY}px)`,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>הודעה חדשה</div>
            {[
              { label: "כותרת", value: "סגירה לחגים" },
              { label: "תוכן", value: "העסק סגור 25-28 אפריל לחופשת פסח" },
              { label: "תאריך תפוגה", value: "28.04.2026" },
            ].map((field) => (
              <div key={field.label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>{field.label}</div>
                <div style={{
                  background: "#f8fafc", border: "1px solid #e2e8f0",
                  borderRadius: 8, padding: "8px 12px",
                  fontSize: 13, color: "#0f172a",
                }}>
                  {field.value}
                </div>
              </div>
            ))}
            <div style={{
              marginTop: 12,
              background: ORANGE, color: "white",
              fontSize: 13, fontWeight: 700,
              padding: "9px 20px", borderRadius: 8, display: "inline-block",
              boxShadow: "0 2px 8px rgba(234,88,12,0.3)",
            }}>
              פרסם
            </div>
          </div>

          {/* Existing messages */}
          {EXISTING_MESSAGES.map((msg, i) => {
            const startFrame = 160 + i * 25;
            const msgP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
            const msgY = interpolate(msgP, [0, 1], [18, 0]);
            const msgOpacity = interpolate(frame, [startFrame, startFrame + 16], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div key={msg.title} style={{
                background: "white", borderRadius: 10, padding: "12px 16px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)", marginBottom: 8,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                opacity: msgOpacity, transform: `translateY(${msgY}px)`,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{msg.title}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{msg.content}</div>
                </div>
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  padding: "3px 10px", borderRadius: 99,
                  background: msg.status === "active" ? "#dcfce7" : "#fee2e2",
                  color: msg.status === "active" ? "#16a34a" : "#dc2626",
                }}>
                  {msg.status === "active" ? "פעיל" : "פג תוקף"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
