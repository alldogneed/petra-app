import {
  AbsoluteFill,
  interpolate,
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

const SETTINGS_ROWS = [
  { label: "שעת צ׳ק-אין", value: "12:00", type: "time" },
  { label: "שעת צ׳ק-אאוט", value: "11:00", type: "time" },
  { label: "מינימום לינות", value: "2 לילות", type: "text" },
  { label: "מחיר ברירת מחדל ללילה", value: "₪120", type: "text" },
];

// RTL 2-col: boarding settings (first DOM) → right col x=545–1042 | calc mode (second DOM) → left col x=28–525
const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,   x: 535, y: 360 },
  { frame: 40,  x: 760, y: 210 },                      // check-in time field
  { frame: 72,  x: 760, y: 210, action: "click" },
  { frame: 112, x: 760, y: 272 },                      // check-out time
  { frame: 145, x: 760, y: 272, action: "click" },
  { frame: 182, x: 760, y: 338 },                      // min nights
  { frame: 212, x: 760, y: 338, action: "click" },
  { frame: 248, x: 200, y: 192 },                      // calc mode "לפי לילות" (left col)
  { frame: 278, x: 200, y: 192, action: "click" },
  { frame: 310, x: 260, y: 368 },                      // info note
];

export const SettingsBoardingScene: React.FC = () => {
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
          transformOrigin: "650px 310px",
        }}
      >
        {/* Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 68% 68% at 65% 45%, transparent 45%, rgba(15,23,42,0.09) 100%)",
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
            <div
              style={{
                background: ORANGE,
                color: "white",
                borderRadius: 8,
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              שמור שינויים
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הגדרות</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>ניהול העסק שלך</span>
            </div>
          </div>

          <SettingsTabsBar activeTab="פנסיון" opacity={headerOpacity} />

          <div style={{ flex: 1, padding: "20px 28px", overflowY: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

              {/* Check-in/out settings — right col */}
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "20px 24px",
                  opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" }),
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>הגדרות פנסיון</div>
                {SETTINGS_ROWS.map((row, i) => {
                  const rOpacity = interpolate(frame, [28 + i * 8, 42 + i * 8], [0, 1], { extrapolateRight: "clamp" });
                  return (
                    <div key={row.label} style={{ marginBottom: 16, opacity: rOpacity }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 5 }}>{row.label}</div>
                      <div
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 7,
                          padding: "8px 12px",
                          fontSize: 13,
                          color: "#0f172a",
                          fontWeight: 500,
                          width: 160,
                        }}
                      >
                        {row.value}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Calculation mode — left col */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                  style={{
                    background: "white",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    padding: "20px 24px",
                    opacity: interpolate(frame, [25, 40], [0, 1], { extrapolateRight: "clamp" }),
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>שיטת חישוב לינות</div>
                  {["לפי לילות", "לפי ימים"].map((mode, i) => {
                    const isActive = i === 0;
                    const mOpacity = interpolate(frame, [35 + i * 10, 50 + i * 10], [0, 1], { extrapolateRight: "clamp" });
                    return (
                      <div
                        key={mode}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: isActive ? "rgba(234,88,12,0.06)" : "#f8fafc",
                          border: isActive ? "1px solid rgba(234,88,12,0.3)" : "1px solid #e2e8f0",
                          marginBottom: 8,
                          opacity: mOpacity,
                        }}
                      >
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: "50%",
                            border: `2px solid ${isActive ? ORANGE : "#e2e8f0"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {isActive && <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE }} />}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? "#0f172a" : "#64748b" }}>
                          {mode}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Info card */}
                <div
                  style={{
                    background: "rgba(59,130,246,0.05)",
                    borderRadius: 10,
                    border: "1px solid rgba(59,130,246,0.2)",
                    padding: "14px 16px",
                    opacity: interpolate(frame, [60, 75], [0, 1], { extrapolateRight: "clamp" }),
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#3b82f6", marginBottom: 6 }}>שים לב</div>
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                    שינוי בהגדרות ישפיע על הזמנות חדשות בלבד. הזמנות קיימות לא ישתנו.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Highlights */}
        {/* Check-in / check-out card — card top=122, fields 1-2 with title: h≈175 */}
        <HighlightBox x={545} y={122} width={497} height={175} startFrame={55} endFrame={200} borderRadius={8} />
        {/* Calculation mode card — left col, card top=122, h≈155 */}
        <HighlightBox x={28} y={122} width={497} height={155} startFrame={228} endFrame={308} borderRadius={12} />

        <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
      </div>
    </AbsoluteFill>
  );
};
