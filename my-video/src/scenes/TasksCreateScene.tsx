// src/scenes/TasksCreateScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { CursorOverlay, CursorWaypoint } from "./CursorOverlay";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

// RTL canvas: "+ משימה חדשה" button right side x≈987, header y≈26.
// Modal save button centered at x≈640, y≈503.
const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,   x: 700, y: 300 },
  { frame: 12,  x: 987, y: 26  },
  { frame: 18,  x: 987, y: 26, action: "click" },
  { frame: 214, x: 640, y: 503 },
  { frame: 220, x: 640, y: 503, action: "click" },
];

// Timeline (all in local frames):
const MODAL_OPEN   = 18;
const TITLE_IN     = 35;
const CAT_IN       = 70;
const PRIORITY_IN  = 100;
const DUE_IN       = 130;
const CUSTOMER_IN  = 165;
const SAVE_CLICK   = 220;
const MODAL_CLOSE  = 232;
const NEW_TASK_IN  = 248;

export const TasksCreateScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [4, 16], [0, 1], { extrapolateRight: "clamp" });

  const modalP = spring({ frame: frame - MODAL_OPEN, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalP, [0, 1], [0.93, 1]);
  const modalOpacity = interpolate(frame, [MODAL_OPEN, MODAL_OPEN + 12], [0, 1], { extrapolateRight: "clamp" })
    * interpolate(frame, [MODAL_CLOSE, MODAL_CLOSE + 10], [1, 0], { extrapolateLeft: "clamp" });

  const titleOpacity  = interpolate(frame, [TITLE_IN,    TITLE_IN + 12],    [0, 1], { extrapolateRight: "clamp" });
  const catOpacity    = interpolate(frame, [CAT_IN,      CAT_IN + 12],      [0, 1], { extrapolateRight: "clamp" });
  const prioOpacity   = interpolate(frame, [PRIORITY_IN, PRIORITY_IN + 12], [0, 1], { extrapolateRight: "clamp" });
  const dueOpacity    = interpolate(frame, [DUE_IN,      DUE_IN + 12],      [0, 1], { extrapolateRight: "clamp" });
  const custOpacity   = interpolate(frame, [CUSTOMER_IN, CUSTOMER_IN + 12], [0, 1], { extrapolateRight: "clamp" });

  // Save button pulse on click
  const savePulse = interpolate(frame, [SAVE_CLICK, SAVE_CLICK + 4, SAVE_CLICK + 9], [1, 0.93, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // New task row after modal closes
  const newRowOpacity = interpolate(frame, [NEW_TASK_IN, NEW_TASK_IN + 14], [0, 1], { extrapolateRight: "clamp" });
  const newRowP = spring({ frame: frame - NEW_TASK_IN, fps, config: { damping: 200 } });
  const newRowY = interpolate(newRowP, [0, 1], [-14, 0]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול משימות" />

      {/* Background task list (blurred) */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, filter: `blur(${modalOpacity > 0.1 ? 2 : 0}px)` }}>
        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>
            + משימה חדשה
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>משימות</div>
        </div>

        {/* New task row appears after save */}
        <div style={{ padding: "12px 24px 0" }}>
          <div style={{
            background: "white", borderRadius: 10,
            border: "1px solid #e2e8f0", borderRight: "3px solid #22c55e",
            padding: "11px 14px",
            display: "flex", alignItems: "center", gap: 12,
            opacity: newRowOpacity, transform: `translateY(${newRowY}px)`,
          }}>
            <div style={{ background: "#f0fdf4", color: "#16a34a", borderRadius: 99, padding: "3px 9px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>עכשיו</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", flex: 1 }}>מתן תרופה לנובה</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#8b5cf6", background: "#8b5cf618", borderRadius: 4, padding: "2px 7px" }}>תרופות</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: ORANGE }} />
              <span style={{ fontSize: 10, color: ORANGE, fontWeight: 600 }}>גבוהה</span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>היום 18:00</div>
          </div>
        </div>
      </div>

      {/* Modal overlay */}
      {modalOpacity > 0.01 && (
        <div style={{
          position: "absolute", inset: 0,
          background: `rgba(15,23,42,${modalOpacity * 0.45})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50,
        }}>
          <div style={{
            background: "white", borderRadius: 20,
            padding: "28px 32px", width: 500,
            transform: `scale(${modalScale})`,
            boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
            direction: "rtl",
          }}>
            {/* Modal header */}
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 22 }}>משימה חדשה</div>

            {/* Title field */}
            <div style={{ marginBottom: 14, opacity: titleOpacity }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>שם המשימה *</label>
              <div style={{ border: `2px solid ${ORANGE}`, borderRadius: 8, padding: "9px 12px", background: "white", boxShadow: "0 0 0 3px rgba(234,88,12,0.1)" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>מתן תרופה לנובה</span>
                <span style={{ display: "inline-block", width: 1.5, height: 14, background: ORANGE, marginRight: 2, verticalAlign: "middle" }} />
              </div>
            </div>

            {/* Category + Priority row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1, opacity: catOpacity }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>קטגוריה</label>
                <div style={{ border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#8b5cf6", fontWeight: 700 }}>תרופות</span>
                  <span style={{ color: "#94a3b8", fontSize: 14 }}>▾</span>
                </div>
              </div>
              <div style={{ flex: 1, opacity: prioOpacity }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>עדיפות</label>
                <div style={{ border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE }} />
                    <span style={{ fontSize: 13, color: ORANGE, fontWeight: 700 }}>גבוהה</span>
                  </div>
                  <span style={{ color: "#94a3b8", fontSize: 14 }}>▾</span>
                </div>
              </div>
            </div>

            {/* Due date/time */}
            <div style={{ marginBottom: 14, opacity: dueOpacity }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>תאריך ושעה</label>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 12px" }}>
                  <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>10.04.2026</span>
                </div>
                <div style={{ width: 100, border: `1.5px solid ${ORANGE}`, borderRadius: 8, padding: "9px 12px", boxShadow: "0 0 0 2px rgba(234,88,12,0.1)" }}>
                  <span style={{ fontSize: 13, color: ORANGE, fontWeight: 700 }}>18:00</span>
                </div>
              </div>
            </div>

            {/* Linked customer */}
            <div style={{ marginBottom: 22, opacity: custOpacity }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 5 }}>קישור ללקוח</label>
              <div style={{
                border: "1.5px solid #22c55e", borderRadius: 8, padding: "9px 12px",
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(34,197,94,0.04)",
              }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>ע</span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>ענבל כהן</span>
                <span style={{ fontSize: 11, color: "#94a3b8", marginRight: "auto" }}>054-321-1234</span>
              </div>
            </div>

            {/* Save button */}
            <div style={{
              background: ORANGE, color: "white",
              borderRadius: 10, padding: "12px",
              textAlign: "center", fontSize: 14, fontWeight: 800,
              transform: `scale(${savePulse})`,
              boxShadow: "0 4px 18px rgba(234,88,12,0.35)",
            }}>
              שמור משימה
            </div>
          </div>
        </div>
      )}
      <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
    </AbsoluteFill>
  );
};
