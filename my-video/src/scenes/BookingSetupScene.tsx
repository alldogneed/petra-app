// src/scenes/BookingSetupScene.tsx
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

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

// Timeline (18s = 540 frames)
const SAT_TOGGLE   = 190;  // שבת toggle clicked (shows it's off)
const BLOCK_CLICK  = 290;  // "+ הוסף חסימה" clicked
const MODAL_OPEN   = 305;  // modal appears
const SAVE_CLICK   = 410;  // "שמור" clicked
const MODAL_CLOSE  = 425;  // modal closes
const BLOCK_ADDED  = 440;  // new block appears in list

const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,          x: 600,  y: 300 },
  { frame: 60,         x: 920,  y: 53  },
  { frame: 70,         x: 920,  y: 53,  action: "click" },
  { frame: 150,        x: 500,  y: 328 },
  { frame: SAT_TOGGLE, x: 490,  y: 328, action: "click" },
  { frame: 250,        x: 200,  y: 478 },
  { frame: BLOCK_CLICK,x: 200,  y: 478, action: "click" },
  { frame: 390,        x: 640,  y: 510 },
  { frame: SAVE_CLICK, x: 640,  y: 510, action: "click" },
];

const WEEK_DAYS = [
  { name: "ראשון", hours: "09:00–18:00", on: true },
  { name: "שני",   hours: "09:00–18:00", on: true },
  { name: "שלישי", hours: "09:00–18:00", on: true },
  { name: "רביעי", hours: "09:00–18:00", on: true },
  { name: "חמישי", hours: "09:00–18:00", on: true },
  { name: "שישי",  hours: "09:00–14:00", on: true },
  { name: "שבת",   hours: "סגור",        on: false },
];

export const BookingSetupScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const satOn = frame < SAT_TOGGLE; // Saturday starts as on, gets toggled off
  const modalOpacity = interpolate(frame, [MODAL_OPEN, MODAL_OPEN + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    * interpolate(frame, [MODAL_CLOSE, MODAL_CLOSE + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const modalP = spring({ frame: frame - MODAL_OPEN, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalP, [0, 1], [0.93, 1]);
  const newBlockOpacity = interpolate(frame, [BLOCK_ADDED, BLOCK_ADDED + 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="הגדרות" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Page header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הגדרות</div>
        </div>

        {/* Tab bar */}
        <div style={{ opacity: headerOpacity }}>
          <SettingsTabsBar activeTab="הזמנות" />
        </div>

        {/* Content */}
        <div style={{ padding: "20px 28px", opacity: headerOpacity }}>

          {/* Section: Weekly hours */}
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>שעות פתיחה</div>
          <div style={{
            background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
            overflow: "hidden", marginBottom: 24,
          }}>
            {WEEK_DAYS.map((day, i) => {
              const rowOpacity = interpolate(frame, [12 + i * 7, 22 + i * 7], [0, 1], { extrapolateRight: "clamp" });
              const isSat = day.name === "שבת";
              const isOn = isSat ? satOn : day.on;
              return (
                <div key={day.name} style={{
                  display: "flex", alignItems: "center", gap: 16,
                  padding: "12px 18px",
                  borderBottom: i < WEEK_DAYS.length - 1 ? "1px solid #f1f5f9" : "none",
                  opacity: rowOpacity,
                }}>
                  {/* Toggle */}
                  <div style={{
                    width: 36, height: 20, borderRadius: 99,
                    background: isOn ? ORANGE : "#cbd5e1",
                    position: "relative", flexShrink: 0, cursor: "pointer",
                    transition: "background 0.2s",
                  }}>
                    <div style={{
                      position: "absolute", top: 2,
                      left: isOn ? 18 : 2,
                      width: 16, height: 16, borderRadius: "50%", background: "white",
                    }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", width: 52 }}>{day.name}</span>
                  <span style={{ fontSize: 12, color: isOn ? "#64748b" : "#cbd5e1", flex: 1 }}>
                    {isOn ? day.hours : "סגור"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Section: Blocked dates */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>חסימת תאריכים</div>
            <div style={{
              background: ORANGE, color: "white", borderRadius: 8,
              padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
              + הוסף חסימה
            </div>
          </div>
          <div style={{
            background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}>
            {/* Existing block */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
              borderBottom: frame >= BLOCK_ADDED ? "1px solid #f1f5f9" : "none",
              opacity: interpolate(frame, [60, 80], [0, 1], { extrapolateRight: "clamp" }),
            }}>
              <span style={{ fontSize: 18 }}>🚫</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>25.04–28.04</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>חופשת פסח</div>
              </div>
            </div>
            {/* New block added after save */}
            {frame >= BLOCK_ADDED && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
                opacity: newBlockOpacity,
              }}>
                <span style={{ fontSize: 18 }}>🚫</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>01.05–02.05</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>יום העצמאות</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add block modal */}
      {modalOpacity > 0.01 && (
        <div style={{
          position: "absolute", inset: 0,
          background: `rgba(15,23,42,${modalOpacity * 0.4})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 80,
        }}>
          <div style={{
            background: "white", borderRadius: 16, padding: "24px 28px", width: 400,
            transform: `scale(${modalScale})`,
            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            direction: "rtl",
            opacity: modalOpacity,
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>חסימת תאריכים</div>
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>מתאריך</div>
                <div style={{ border: "2px solid #3b82f6", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#3b82f6" }}>01.05.2026</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>עד תאריך</div>
                <div style={{ border: "2px solid #3b82f6", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, color: "#3b82f6" }}>02.05.2026</div>
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>סיבה (אופציונלי)</div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#0f172a" }}>יום העצמאות</div>
            </div>
            <div style={{
              background: ORANGE, color: "white", borderRadius: 10, padding: "11px",
              textAlign: "center", fontSize: 14, fontWeight: 800, cursor: "pointer",
            }}>
              שמור
            </div>
          </div>
        </div>
      )}

      <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
    </AbsoluteFill>
  );
};
