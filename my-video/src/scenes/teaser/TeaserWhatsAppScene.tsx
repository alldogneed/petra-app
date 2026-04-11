// src/scenes/teaser/TeaserWhatsAppScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { PainOverlay } from "../../components/teaser/PainOverlay";
import { BenefitTag } from "../../components/teaser/BenefitTag";
import { CursorAnimation } from "../../components/teaser/CursorAnimation";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

const MESSAGES = [
  {
    name: "ענבל כהן",
    text: "תזכורת: תור מחר ב-09:00 🐾",
    status: "sent",
    time: "08:00",
    color: "#10b981",
    delay: 58,
  },
  {
    name: "יוסי גולן",
    text: "תזכורת: פנסיון — יציאה מחר ב-10:00",
    status: "sent",
    time: "08:00",
    color: "#10b981",
    delay: 68,
  },
  {
    name: "מיכל לוי",
    text: "תזכורת: שיעור אילוף היום ב-14:00 🐕",
    status: "pending",
    time: "13:00",
    color: "#f59e0b",
    delay: 78,
  },
  {
    name: "עמית שפירא",
    text: "תזכורת: טיפוח מחר ב-11:30",
    status: "pending",
    time: "10:30",
    color: "#f59e0b",
    delay: 88,
  },
];

// The "pending" message at delay 78 transitions to "sent" at this frame
const SEND_FRAME = 104;

export const TeaserWhatsAppScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [52, 65], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(frame, [52, 70], [0, 3.5], { extrapolateRight: "clamp" });

  const zoomP = spring({ frame: frame - 54, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.13]);

  // The third message "sends" at SEND_FRAME
  const sendProgress = interpolate(frame, [SEND_FRAME, SEND_FRAME + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
        <PetraSidebar width={SIDEBAR_W} activeLabel="הודעות" />
      </div>

      {/* Zoomable content */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "60% 38%", width: "100%", height: "100%" }}>

          {/* Header */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            padding: "0 24px", height: 52,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            opacity: headerOpacity,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הודעות אוטומטיות</div>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#f0fdf4", border: "1px solid #86efac",
              borderRadius: 8, padding: "4px 12px",
              fontSize: 11, fontWeight: 700, color: "#16a34a",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
              פעיל — שולח אוטומטית
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10, padding: "14px 24px 10px",
            opacity: interpolate(frame, [55, 68], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            {[
              { label: "נשלחו היום", value: "12", color: "#10b981" },
              { label: "ממתינות לשליחה", value: "4", color: "#f59e0b" },
              { label: "אחוז פתיחה", value: "94%", color: "#3b82f6" },
            ].map((s) => (
              <div key={s.label} style={{
                background: "white", borderRadius: 10,
                border: "1px solid #e2e8f0", padding: "10px 14px",
              }}>
                <div style={{ fontSize: 9, color: "#64748b", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Messages list */}
          <div style={{ margin: "0 24px", background: "white", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "2fr 3fr 1fr 1fr",
              background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
              padding: "8px 16px",
            }}>
              {["לקוח", "הודעה", "שעה", "סטטוס"].map((h) => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8" }}>{h}</div>
              ))}
            </div>

            {MESSAGES.map((msg, i) => {
              const rowOpacity = interpolate(frame, [msg.delay, msg.delay + 10], [0, 1], { extrapolateRight: "clamp" });
              const p = spring({ frame: frame - msg.delay, fps, config: { damping: 200 } });
              const y = interpolate(p, [0, 1], [8, 0]);

              // Third message transitions from pending to sent
              const isSending = i === 2 && frame >= SEND_FRAME;
              const effectiveStatus = isSending ? "sent" : msg.status;
              const effectiveColor = isSending ? "#10b981" : msg.color;
              const statusBg = effectiveStatus === "sent" ? "#ecfdf5" : "#fffbeb";
              const statusText = effectiveStatus === "sent" ? "נשלח ✓" : "ממתין";

              // Glow on the sending row
              const glowOpacity = isSending
                ? interpolate(sendProgress, [0, 0.4, 1], [0, 1, 0])
                : 0;

              return (
                <div key={msg.name} style={{
                  display: "grid", gridTemplateColumns: "2fr 3fr 1fr 1fr",
                  padding: "11px 16px", alignItems: "center",
                  borderBottom: i < MESSAGES.length - 1 ? "1px solid #f1f5f9" : "none",
                  opacity: rowOpacity, transform: `translateY(${y}px)`,
                  boxShadow: glowOpacity > 0.05 ? `0 0 16px rgba(16,185,129,${glowOpacity * 0.4})` : "none",
                  background: glowOpacity > 0.05 ? `rgba(16,185,129,${glowOpacity * 0.04})` : "transparent",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{msg.name}</div>
                  <div style={{ fontSize: 10, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{msg.text}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{msg.time}</div>
                  <div style={{
                    fontSize: 9, fontWeight: 700,
                    background: statusBg, color: effectiveColor,
                    borderRadius: 6, padding: "2px 7px",
                    display: "inline-flex", alignItems: "center", gap: 3,
                    transition: "all 0.3s",
                  }}>
                    {statusText}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cursor hovers over the "ממתין" row then it sends */}
      <CursorAnimation
        startX={640} startY={460}
        endX={760} endY={310}
        appearAt={60}
        clickAt={SEND_FRAME}
      />

      <PainOverlay text="תזכורות נשכחות — לקוחות מתעצבנים" fadeOutStart={35} fadeOutEnd={52} />
      <BenefitTag text="WhatsApp אוטומטי — בלי מגע יד" appearAt={68} />
    </AbsoluteFill>
  );
};
