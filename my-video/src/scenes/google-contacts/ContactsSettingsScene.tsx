/**
 * Scene 1: Settings page — user enables Google Contacts sync toggle.
 */
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { CursorOverlay } from "../CursorOverlay";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

export const ContactsSettingsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateRight: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Toggle animation at ~2.5s
  const toggleFrame = Math.round(fps * 2.5);
  const toggleProgress = spring({ frame: frame - toggleFrame, fps, config: { damping: 15, stiffness: 120 } });

  // Card entrance
  const cardP = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const cardY = interpolate(cardP, [0, 1], [40, 0]);

  // Step label
  const stepOpacity = interpolate(frame, [0, fps * 0.8], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="הגדרות" />

      {/* Step indicator */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          background: "#ea580c",
          color: "white",
          padding: "6px 18px",
          borderRadius: 20,
          fontSize: 14,
          fontWeight: 700,
          opacity: stepOpacity,
          zIndex: 20,
        }}
      >
        Step 1 of 3 — Enable Sync
      </div>

      {/* Main content area */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: SIDEBAR_W,
          left: 0,
          bottom: 0,
          padding: "32px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a" }}>
          הגדרות — אינטגרציות
        </div>

        {/* Google Calendar Card (already connected) */}
        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: "20px 24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            border: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: 16,
            transform: `translateY(${cardY}px)`,
          }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#4285f4", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>Google Calendar</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>מחובר — or.rabinovich@gmail.com</div>
          </div>
          <div style={{ background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 600, padding: "4px 12px", borderRadius: 20 }}>
            מחובר
          </div>
        </div>

        {/* Google Contacts Sync Card — the main event */}
        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: "20px 24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            border: frame >= toggleFrame ? "2px solid #ea580c" : "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: 16,
            transform: `translateY(${cardY}px)`,
            transition: "border 0.3s",
          }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#34a853", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>סנכרון אנשי קשר Google</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              לידים חדשים יתווספו אוטומטית לאנשי הקשר שלך ב-Google
            </div>
          </div>

          {/* Toggle */}
          <div
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              background: interpolate(toggleProgress, [0, 1], [0, 1]) > 0.5 ? "#22c55e" : "#cbd5e1",
              position: "relative",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: "white",
                position: "absolute",
                top: 3,
                right: interpolate(toggleProgress, [0, 1], [3, 23]),
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </div>
        </div>

        {/* Success toast */}
        {frame >= toggleFrame + 15 && (
          <div
            style={{
              position: "absolute",
              bottom: 30,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#166534",
              color: "white",
              padding: "10px 24px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              opacity: interpolate(frame, [toggleFrame + 15, toggleFrame + 25, durationInFrames - fps * 0.5, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
          >
            סנכרון אנשי קשר הופעל בהצלחה
          </div>
        )}
      </div>
      {/* Animated cursor */}
      <CursorOverlay
        waypoints={[
          { frame: 0, x: 500, y: 400 },
          { frame: Math.round(fps * 1), x: 85, y: 230 },
          { frame: Math.round(fps * 2), x: 85, y: 230 },
          { frame: toggleFrame, x: 85, y: 230, action: "click" },
          { frame: Math.round(fps * 4), x: 85, y: 230 },
          { frame: Math.round(fps * 5), x: 400, y: 400 },
        ]}
      />
    </AbsoluteFill>
  );
};
