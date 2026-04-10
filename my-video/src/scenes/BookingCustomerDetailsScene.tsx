// src/scenes/BookingCustomerDetailsScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CursorOverlay, CursorWaypoint } from "./CursorOverlay";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";

// Timeline (18s = 540 frames)
const DOG_CLICK     = 180;  // dog card checkbox clicked
const CONFIRM_START = 230;  // confirm screen fades in
const CONFIRM_CLICK = 340;  // "אשר הזמנה" clicked
const DONE_START    = 355;  // done screen fades in

const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,            x: 640, y: 360 },
  { frame: 25,           x: 640, y: 260 },
  { frame: 35,           x: 640, y: 260, action: "click" },
  { frame: 160,          x: 400, y: 420 },
  { frame: DOG_CLICK,    x: 390, y: 420, action: "click" },
  { frame: 310,          x: 640, y: 560 },
  { frame: CONFIRM_CLICK,x: 640, y: 560, action: "click" },
];

// Typewriter for name: frame 35-110 (75 frames = 2.5s for 8 chars)
const NAME_FULL = "ענבל כהן";
const PHONE_FULL = "054-321-1234";

function typewriter(full: string, startFrame: number, fps: number, frame: number): string {
  const charsPerSec = 4;
  const elapsed = Math.max(0, frame - startFrame) / fps;
  const charsVisible = Math.floor(elapsed * charsPerSec * fps / fps * charsPerSec);
  return full.slice(0, Math.min(charsVisible, full.length));
}

export const BookingCustomerDetailsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const nameText = typewriter(NAME_FULL, 35, fps, frame);
  const phoneText = typewriter(PHONE_FULL, 110, fps, frame);

  const dogChecked = frame >= DOG_CLICK;

  const confirmOpacity = interpolate(frame, [CONFIRM_START, CONFIRM_START + 20], [0, 1], { extrapolateRight: "clamp" });
  const confirmP = spring({ frame: frame - CONFIRM_START, fps, config: { damping: 200 } });
  const confirmY = interpolate(confirmP, [0, 1], [20, 0]);

  const formOpacity = interpolate(frame, [CONFIRM_START - 10, CONFIRM_START + 5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const doneOpacity = interpolate(frame, [DONE_START, DONE_START + 20], [0, 1], { extrapolateRight: "clamp" });
  const doneP = spring({ frame: frame - DONE_START, fps, config: { damping: 200 } });
  const doneScale = interpolate(doneP, [0, 1], [0.7, 1]);

  return (
    <AbsoluteFill style={{
      background: "white",
      fontFamily: FONT,
      direction: "rtl",
      opacity,
    }}>
      {/* Orange top border */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: ORANGE }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 4, left: 0, right: 0, height: 56,
        background: "white", borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>פנסיון כלבים שמח</span>
      </div>

      {/* Step indicator — step 2 */}
      <div style={{
        position: "absolute", top: 60, left: 0, right: 0, height: 44,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        borderBottom: "1px solid #f1f5f9",
      }}>
        {[1, 2, 3].map((step) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: step <= 2 ? ORANGE : "#e2e8f0",
              color: step <= 2 ? "white" : "#94a3b8",
              fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {step === 1 ? "✓" : step}
            </div>
            {step < 3 && <div style={{ width: 40, height: 2, background: step < 2 ? ORANGE : "#e2e8f0" }} />}
          </div>
        ))}
        <span style={{ fontSize: 12, color: "#64748b", marginRight: 8 }}>שלב 2 מתוך 3</span>
      </div>

      {/* Customer form */}
      {frame < DONE_START && (
        <div style={{
          position: "absolute", top: 104, left: 0, right: 0, bottom: 0,
          padding: "24px 80px", opacity: formOpacity,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>פרטים אישיים</div>

          {/* Name field */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>שם מלא</div>
            <div style={{
              border: `2px solid ${nameText ? ORANGE : "#e2e8f0"}`,
              borderRadius: 10, padding: "10px 14px",
              fontSize: 15, color: "#0f172a", minHeight: 42,
              background: "white", display: "flex", alignItems: "center",
            }}>
              {nameText}
              {nameText.length < NAME_FULL.length && <span style={{ opacity: 0.5 }}>|</span>}
            </div>
          </div>

          {/* Phone field */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>טלפון</div>
            <div style={{
              border: `2px solid ${phoneText ? ORANGE : "#e2e8f0"}`,
              borderRadius: 10, padding: "10px 14px",
              fontSize: 15, color: "#0f172a", minHeight: 42,
              background: "white", display: "flex", alignItems: "center",
            }}>
              {phoneText}
            </div>
          </div>

          {/* Dog section */}
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>הכלבים שלך</div>
          <div style={{
            border: `2px solid ${dogChecked ? ORANGE : "#e2e8f0"}`,
            borderRadius: 12, padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 14,
            background: dogChecked ? "rgba(234,88,12,0.04)" : "white",
            marginBottom: 12,
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 6,
              border: `2px solid ${dogChecked ? ORANGE : "#cbd5e1"}`,
              background: dogChecked ? ORANGE : "white",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {dogChecked && <span style={{ color: "white", fontSize: 13, fontWeight: 900 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>מקס</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>לברדור · ♂</div>
            </div>
          </div>
          <div style={{
            border: "1.5px dashed #e2e8f0", borderRadius: 10,
            padding: "10px 14px", color: "#64748b", fontSize: 13, fontWeight: 600,
            cursor: "pointer", textAlign: "center",
          }}>
            + כלב חדש
          </div>
        </div>
      )}

      {/* Confirm screen */}
      {frame >= CONFIRM_START && frame < DONE_START && (
        <div style={{
          position: "absolute", top: 104, left: 0, right: 0, bottom: 0,
          padding: "24px 80px",
          opacity: confirmOpacity, transform: `translateY(${confirmY}px)`,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>אישור הזמנה</div>

          {/* Summary card */}
          <div style={{
            border: "1px solid #e2e8f0", borderRadius: 16,
            padding: "20px 24px", background: "#fafafa", marginBottom: 20,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "שירות",    value: "טיפול ורחצה" },
                { label: "תאריך",    value: "11.05.2026" },
                { label: "שעה",      value: "11:00 – 11:45" },
                { label: "כלב",      value: "מקס (לברדור)" },
                { label: "מחיר",     value: "₪150" },
              ].map((row) => (
                <div key={row.label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 20, textAlign: "center" }}>
            ניתן לבטל עד 24 שעות לפני התור
          </div>

          {/* CTA button */}
          <div style={{
            background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
            borderRadius: 14, padding: "15px",
            textAlign: "center", cursor: "pointer",
            boxShadow: "0 6px 24px rgba(234,88,12,0.35)",
          }}>
            <span style={{ color: "white", fontSize: 16, fontWeight: 800 }}>אשר הזמנה</span>
          </div>
        </div>
      )}

      {/* Done screen */}
      {frame >= DONE_START && (
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 16, background: "white",
          opacity: doneOpacity, transform: `scale(${doneScale})`,
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "#dcfce7",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 40 }}>✅</span>
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#0f172a" }}>תורך נקבע!</div>
          <div style={{ fontSize: 16, color: "#64748b" }}>נשמח לראות אותך ב-11.05 בשעה 11:00</div>
        </div>
      )}

      <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
    </AbsoluteFill>
  );
};
