import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { SettingsTabsBar } from "./SettingsTabsBar";
import { CursorOverlay, CursorWaypoint } from "./CursorOverlay";
import { HighlightBox } from "./HighlightBox";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const ORANGE = "#ea580c";

const INTEGRATIONS = [
  {
    name: "Google Calendar",
    desc: "סנכרון תורים והזמנות עם היומן שלך — דו-כיווני ואוטומטי.",
    status: "מחובר",
    statusColor: "#22c55e",
    statusBg: "#f0fdf4",
    color: "#4285f4",
    delay: 20,
  },
  {
    name: "WhatsApp",
    desc: "שליחת הודעות, תזכורות ואוטומציות ישירות ללקוחות.",
    status: "מחובר",
    statusColor: "#22c55e",
    statusBg: "#f0fdf4",
    color: "#25d366",
    delay: 40,
  },
  {
    name: "Make.com",
    desc: "אוטומציות מתקדמות וחיבורים חיצוניים — בלי קוד.",
    status: "לא מחובר",
    statusColor: "#94a3b8",
    statusBg: "#f8fafc",
    color: "#7c3aed",
    delay: 60,
  },
];

// Cards maxWidth:780 → right-aligned in RTL: x=1042-780=262 to x=1042
// Card layout RTL: first child (color badge) → RIGHT x≈990 | last child (status+button) → LEFT x≈290
// Cards: card1 y=120-196, card2 y=212-288, card3 y=304-380
const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,   x: 535, y: 360 },
  { frame: 25,  x: 640, y: 158 },                      // Google Calendar card center
  { frame: 58,  x: 310, y: 168 },                      // "מחובר" status / "נהל חיבור" button (left side)
  { frame: 92,  x: 310, y: 168 },
  { frame: 118, x: 310, y: 168, action: "click" },
  { frame: 158, x: 640, y: 250 },                      // WhatsApp card
  { frame: 192, x: 310, y: 250 },                      // button
  { frame: 222, x: 310, y: 250, action: "click" },
  { frame: 260, x: 640, y: 342 },                      // Make.com card
  { frame: 295, x: 310, y: 348 },                      // "התחבר" button
  { frame: 328, x: 310, y: 348, action: "click" },
  { frame: 372, x: 535, y: 350 },
];

export const SettingsIntegrationsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const zoomScale = interpolate(frame, [0, durationInFrames], [1.0, 1.05], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", overflow: "hidden", opacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoomScale})`,
          transformOrigin: "535px 330px",
        }}
      >
        {/* Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 72% 72% at 52% 47%, transparent 44%, rgba(15,23,42,0.09) 100%)",
            pointerEvents: "none",
            zIndex: 98,
          }}
        />

        <PetraSidebar activeLabel="הגדרות" />

        <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>

          <div
            style={{
              background: "white",
              borderBottom: "1px solid #e2e8f0",
              padding: "0 28px",
              height: 58,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: headerOpacity,
            }}
          >
            <div style={{ width: 80 }} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הגדרות</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>ניהול העסק שלך</span>
            </div>
          </div>

          <SettingsTabsBar activeTab="אינטגרציות" opacity={headerOpacity} />

          <div style={{ flex: 1, padding: "24px 28px", overflowY: "hidden" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 780 }}>
              {INTEGRATIONS.map((integ) => {
                const cardOpacity = interpolate(frame, [integ.delay, integ.delay + 14], [0, 1], { extrapolateRight: "clamp" });
                const cardX = interpolate(
                  spring({ frame: frame - integ.delay, fps, config: { damping: 200 } }),
                  [0, 1],
                  [20, 0]
                );
                const isConnected = integ.status === "מחובר";
                return (
                  <div
                    key={integ.name}
                    style={{
                      background: "white",
                      borderRadius: 12,
                      border: `1px solid ${isConnected ? "rgba(34,197,94,0.2)" : "#e2e8f0"}`,
                      padding: "18px 24px",
                      opacity: cardOpacity,
                      transform: `translateX(${cardX}px)`,
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                    }}
                  >
                    {/* Color badge */}
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: `${integ.color}18`,
                        border: `1px solid ${integ.color}30`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: integ.color }} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>{integ.name}</div>
                      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{integ.desc}</div>
                    </div>

                    {/* Status + button */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: integ.statusColor,
                          background: integ.statusBg,
                          borderRadius: 99,
                          padding: "3px 10px",
                          border: `1px solid ${integ.statusColor}30`,
                        }}
                      >
                        {integ.status}
                      </span>
                      <div
                        style={{
                          background: isConnected ? "white" : ORANGE,
                          border: isConnected ? "1px solid #e2e8f0" : "none",
                          borderRadius: 8,
                          padding: "7px 18px",
                          fontSize: 12,
                          fontWeight: 700,
                          color: isConnected ? "#64748b" : "white",
                        }}
                      >
                        {isConnected ? "נהל חיבור" : "התחבר"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Highlights */}
        {/* Google Calendar card */}
        <HighlightBox x={262} y={120} width={780} height={91} startFrame={40} endFrame={142} borderRadius={12} />
        {/* WhatsApp card */}
        <HighlightBox x={262} y={227} width={780} height={91} startFrame={148} endFrame={248} borderRadius={12} />
        {/* Make.com card */}
        <HighlightBox x={262} y={334} width={780} height={91} startFrame={252} endFrame={365} borderRadius={12} />

        <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
      </div>
    </AbsoluteFill>
  );
};
