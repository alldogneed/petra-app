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

const FIELDS = [
  { label: "שם העסק", value: "מרכז אילוף פטרה", width: 340 },
  { label: "מספר טלפון", value: "052-1234567", width: 220 },
  { label: "אימייל עסקי", value: "info@petra-app.com", width: 280 },
  { label: "מספר עוסק מורשה", value: "515123456", width: 200 },
];

// Canvas: 1280×720 | Content area: x=0–1070 (sidebar on right, marginRight:210)
// RTL 2-col grid: first DOM child → RIGHT col (x=545–1042), second → LEFT col (x=28–525)
// Header: y=0–58 | TabsBar: y=58–102 | Content: y=102–720 (padding-top 20 → cards at y=122)
const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,   x: 535, y: 360 },
  { frame: 45,  x: 700, y: 185 },                       // hover business name field (right col)
  { frame: 85,  x: 700, y: 185 },
  { frame: 105, x: 700, y: 185, action: "click" },
  { frame: 148, x: 700, y: 248 },                       // phone field
  { frame: 182, x: 700, y: 248, action: "click" },
  { frame: 225, x: 300, y: 235 },                       // logo area (left col)
  { frame: 258, x: 230, y: 305 },                       // upload button
  { frame: 290, x: 230, y: 305, action: "click" },
  { frame: 330, x: 200, y: 450 },                       // subscription card
  { frame: 358, x: 200, y: 462, action: "click" },      // upgrade button
];

export const SettingsBusinessScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const headerY = interpolate(spring({ frame: frame - 5, fps, config: { damping: 200 } }), [0, 1], [-16, 0]);

  // Slow camera zoom toward right col (business fields)
  const zoomScale = interpolate(frame, [0, durationInFrames], [1.0, 1.045], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", overflow: "hidden", opacity }}>
      {/* Zoom wrapper — everything inside scales together */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoomScale})`,
          transformOrigin: "680px 290px",
        }}
      >
        {/* Vignette — softens periphery */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 72% 72% at 65% 45%, transparent 45%, rgba(15,23,42,0.09) 100%)",
            pointerEvents: "none",
            zIndex: 98,
          }}
        />

        <PetraSidebar activeLabel="הגדרות" />

        <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>

          {/* Top header bar */}
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
              transform: `translateY(${headerY}px)`,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <div
                style={{
                  background: "#ea580c",
                  color: "white",
                  borderRadius: 8,
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                שמור שינויים
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הגדרות</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>ניהול העסק שלך</span>
            </div>
          </div>

          {/* Tabs */}
          <SettingsTabsBar activeTab="פרטי העסק" opacity={headerOpacity} />

          {/* Content */}
          <div style={{ flex: 1, padding: "20px 28px", overflowY: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

              {/* Business details card — right col in RTL */}
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "20px 24px",
                  opacity: interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" }),
                  transform: `translateY(${interpolate(spring({ frame: frame - 20, fps, config: { damping: 200 } }), [0, 1], [16, 0])}px)`,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>פרטי העסק</div>
                {FIELDS.map((f, i) => {
                  const fOpacity = interpolate(frame, [30 + i * 8, 44 + i * 8], [0, 1], { extrapolateRight: "clamp" });
                  return (
                    <div key={f.label} style={{ marginBottom: 14, opacity: fOpacity }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 5 }}>{f.label}</div>
                      <div
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 7,
                          padding: "8px 12px",
                          fontSize: 13,
                          color: "#0f172a",
                          fontWeight: 500,
                          width: f.width,
                          maxWidth: "100%",
                        }}
                      >
                        {f.value}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Logo + subscription — left col in RTL */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                  style={{
                    background: "white",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    padding: "20px 24px",
                    opacity: interpolate(frame, [28, 42], [0, 1], { extrapolateRight: "clamp" }),
                    transform: `translateY(${interpolate(spring({ frame: frame - 28, fps, config: { damping: 200 } }), [0, 1], [16, 0])}px)`,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>לוגו העסק</div>
                  <div
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: 12,
                      background: "#f1f5f9",
                      border: "2px dashed #e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 12,
                      gap: 6,
                    }}
                  >
                    <div style={{ width: 28, height: 28, background: "#ea580c", borderRadius: 8, opacity: 0.8 }} />
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>לוגו</span>
                  </div>
                  <div
                    style={{
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: 7,
                      padding: "7px 14px",
                      fontSize: 12,
                      color: "#475569",
                      fontWeight: 600,
                      display: "inline-block",
                    }}
                  >
                    העלה תמונה
                  </div>
                </div>

                <div
                  style={{
                    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                    borderRadius: 12,
                    border: "1px solid rgba(234,88,12,0.4)",
                    padding: "18px 20px",
                    opacity: interpolate(frame, [55, 70], [0, 1], { extrapolateRight: "clamp" }),
                    transform: `translateY(${interpolate(spring({ frame: frame - 55, fps, config: { damping: 200 } }), [0, 1], [16, 0])}px)`,
                  }}
                >
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>מנוי נוכחי</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "white", marginBottom: 4 }}>PRO</div>
                  <div style={{ fontSize: 12, color: "#fb923c", fontWeight: 600, marginBottom: 12 }}>חידוש ב-01/05/2026</div>
                  <div
                    style={{
                      background: "rgba(234,88,12,0.2)",
                      border: "1px solid rgba(234,88,12,0.5)",
                      borderRadius: 7,
                      padding: "7px 14px",
                      fontSize: 12,
                      color: "#fb923c",
                      fontWeight: 700,
                      display: "inline-block",
                    }}
                  >
                    שדרג מנוי
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Highlights */}
        {/* Business fields card — right col top=122, through field 2 (title+2×field): h≈175 */}
        <HighlightBox x={545} y={122} width={497} height={175} startFrame={70} endFrame={185} borderRadius={8} />
        {/* Subscription card — logo card(h≈200)+gap(16) → y=338, subscription card h≈135 */}
        <HighlightBox x={28} y={338} width={497} height={135} startFrame={300} endFrame={375} borderRadius={12} />

        {/* Cursor */}
        <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
      </div>
    </AbsoluteFill>
  );
};
