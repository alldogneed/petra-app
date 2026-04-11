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

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DAY_HOURS = [
  { open: true, from: "08:00", to: "18:00" },
  { open: true, from: "08:00", to: "18:00" },
  { open: true, from: "08:00", to: "18:00" },
  { open: true, from: "08:00", to: "18:00" },
  { open: true, from: "08:00", to: "16:00" },
  { open: true, from: "09:00", to: "13:00" },
  { open: false, from: "", to: "" },
];

// RTL 2-col: availability (first DOM) → right col x=545–1042 | online booking (second DOM) → left col x=28–525
// Toggle is first child in RTL flex row → rightmost in that row, x≈1005
// Online booking toggle: left side (RTL end) of its card ≈ x=80
const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,   x: 535, y: 360 },
  { frame: 38,  x: 1005, y: 188 },                     // Sunday toggle
  { frame: 68,  x: 1005, y: 188, action: "click" },
  { frame: 115, x: 1005, y: 322 },                     // Thursday toggle
  { frame: 150, x: 1005, y: 322, action: "click" },
  { frame: 195, x: 90,   y: 210 },                     // online booking toggle (left side)
  { frame: 228, x: 90,   y: 210, action: "click" },
  { frame: 268, x: 360,  y: 512 },                     // booking link URL
  { frame: 305, x: 240,  y: 558 },                     // copy button
  { frame: 340, x: 240,  y: 558, action: "click" },
  { frame: 385, x: 535,  y: 360 },
];

export const SettingsOrdersScene: React.FC = () => {
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
          transformOrigin: "800px 300px",
        }}
      >
        {/* Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 70% 70% at 72% 45%, transparent 45%, rgba(15,23,42,0.09) 100%)",
            pointerEvents: "none",
            zIndex: 98,
          }}
        />

        <PetraSidebar activeLabel="הגדרות" />

        <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>

          {/* Top header */}
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

          <SettingsTabsBar activeTab="הזמנות" opacity={headerOpacity} />

          <div style={{ flex: 1, padding: "20px 28px", overflowY: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

              {/* Availability card — right col in RTL */}
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "20px 24px",
                  opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" }),
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>שעות זמינות</div>
                {DAYS.map((day, i) => {
                  const h = DAY_HOURS[i];
                  const rowOpacity = interpolate(frame, [25 + i * 5, 38 + i * 5], [0, 1], { extrapolateRight: "clamp" });
                  return (
                    <div
                      key={day}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 8,
                        opacity: rowOpacity,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 18,
                          borderRadius: 99,
                          background: h.open ? ORANGE : "#e2e8f0",
                          position: "relative",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            top: 2,
                            left: h.open ? 16 : 2,
                            width: 14,
                            height: 14,
                            borderRadius: "50%",
                            background: "white",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", width: 45 }}>{day}</span>
                      {h.open ? (
                        <>
                          <div
                            style={{
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                              padding: "4px 10px",
                              fontSize: 12,
                              color: "#475569",
                            }}
                          >
                            {h.from}
                          </div>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>
                          <div
                            style={{
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                              padding: "4px 10px",
                              fontSize: 12,
                              color: "#475569",
                            }}
                          >
                            {h.to}
                          </div>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>סגור</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right column — left col in RTL */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Online booking card */}
                <div
                  style={{
                    background: "white",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    padding: "20px 24px",
                    opacity: interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" }),
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>הזמנות אונליין</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>פעיל</span>
                      <div style={{ width: 32, height: 18, borderRadius: 99, background: "#22c55e", position: "relative" }}>
                        <div style={{ position: "absolute", top: 2, left: 16, width: 14, height: 14, borderRadius: "50%", background: "white" }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>קישור לעמוד ההזמנה שלך</div>
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 7,
                      padding: "8px 12px",
                      fontSize: 11,
                      color: ORANGE,
                      fontWeight: 600,
                      direction: "ltr",
                      textAlign: "left",
                    }}
                  >
                    petra-app.com/book/my-business
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      background: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: 7,
                      padding: "6px 12px",
                      fontSize: 11,
                      color: "#475569",
                      fontWeight: 600,
                      display: "inline-block",
                    }}
                  >
                    העתק קישור
                  </div>
                </div>

                {/* Cancellation policy card */}
                <div
                  style={{
                    background: "white",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    padding: "20px 24px",
                    opacity: interpolate(frame, [55, 70], [0, 1], { extrapolateRight: "clamp" }),
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>מדיניות ביטול</div>
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 7,
                      padding: "10px 12px",
                      fontSize: 12,
                      color: "#475569",
                      lineHeight: 1.5,
                      minHeight: 60,
                    }}
                  >
                    ביטול עד 24 שעות לפני מקבל החזר מלא.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Highlights */}
        {/* Sunday–Shabbat availability grid — card top=122, grid 7×24px rows+8px gaps=216, total card h≈289 */}
        <HighlightBox x={545} y={122} width={497} height={289} startFrame={52} endFrame={165} borderRadius={10} />
        {/* Online booking card — same y=122, card h≈160 */}
        <HighlightBox x={28} y={122} width={497} height={160} startFrame={190} endFrame={340} borderRadius={12} />

        <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
      </div>
    </AbsoluteFill>
  );
};
