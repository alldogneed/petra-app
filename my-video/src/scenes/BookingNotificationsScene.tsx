// src/scenes/BookingNotificationsScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

// Timeline (16s = 480 frames)
const WA_SLIDE_START  = 20;
const CAL_SLIDE_START = 60;

export const BookingNotificationsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  // WhatsApp card
  const waP = spring({ frame: frame - WA_SLIDE_START, fps, config: { damping: 160, stiffness: 120 } });
  const waX = interpolate(waP, [0, 1], [80, 0]);
  const waOpacity = interpolate(frame, [WA_SLIDE_START, WA_SLIDE_START + 12], [0, 1], { extrapolateRight: "clamp" });
  const waGlow = interpolate(frame, [WA_SLIDE_START + 12, WA_SLIDE_START + 35, WA_SLIDE_START + 50], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Calendar card
  const calP = spring({ frame: frame - CAL_SLIDE_START, fps, config: { damping: 160, stiffness: 120 } });
  const calX = interpolate(calP, [0, 1], [80, 0]);
  const calOpacity = interpolate(frame, [CAL_SLIDE_START, CAL_SLIDE_START + 12], [0, 1], { extrapolateRight: "clamp" });
  const calGlow = interpolate(frame, [CAL_SLIDE_START + 12, CAL_SLIDE_START + 35, CAL_SLIDE_START + 50], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      opacity,
      background: `radial-gradient(ellipse at 50% 40%, rgba(234,88,12,${0.06 + pulse * 0.03}) 0%, transparent 55%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
      fontFamily: FONT,
      direction: "rtl",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 32,
    }}>
      {/* Decorative dots */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${12 + i * 10}%`, left: `${4 + i * 13}%`,
          width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
          borderRadius: "50%", background: "rgba(255,255,255,0.2)",
        }} />
      ))}

      {/* WhatsApp card */}
      <div style={{
        background: "white",
        borderRadius: 20,
        overflow: "hidden",
        width: 440,
        opacity: waOpacity,
        transform: `translateX(${waX}px)`,
        boxShadow: `0 8px 40px rgba(0,0,0,0.35), 0 0 0 ${waGlow * 3}px rgba(37,211,102,${waGlow * 0.4})`,
      }}>
        {/* Header */}
        <div style={{
          background: "#25D366",
          padding: "12px 18px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>💬</span>
          <span style={{ color: "white", fontSize: 15, fontWeight: 800 }}>פטרה 🐾</span>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginRight: "auto" }}>עכשיו</span>
        </div>
        {/* Body */}
        <div style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>📅 הזמנה חדשה!</div>
          <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.7 }}>
            ענבל כהן — טיפול ורחצה<br />
            מקס (לברדור)<br />
            11.05 · 11:00
          </div>
        </div>
      </div>

      {/* Google Calendar card */}
      <div style={{
        background: "white",
        borderRadius: 20,
        overflow: "hidden",
        width: 440,
        opacity: calOpacity,
        transform: `translateX(${calX}px)`,
        boxShadow: `0 8px 40px rgba(0,0,0,0.35), 0 0 0 ${calGlow * 3}px rgba(66,133,244,${calGlow * 0.4})`,
      }}>
        {/* Header */}
        <div style={{
          background: "#4285F4",
          padding: "12px 18px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>📆</span>
          <span style={{ color: "white", fontSize: 15, fontWeight: 800 }}>Google Calendar</span>
        </div>
        {/* Body */}
        <div style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>טיפול ורחצה — ענבל כהן</div>
          <div style={{ fontSize: 13, color: "#334155", marginBottom: 8 }}>11 מאי, 11:00–11:45</div>
          <div style={{
            display: "inline-block",
            background: "#e8f0fe", color: "#1967d2",
            borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700,
          }}>
            נוצר אוטומטית ע״י פטרה
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
