// src/scenes/CalendarRecurringScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";

const FREQ_OPTIONS = [
  { label: "כל שבוע", selected: true },
  { label: "כל שבועיים", selected: false },
  { label: "כל חודש", selected: false },
];

export const CalendarRecurringScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const backdropOpacity = interpolate(frame, [5, 18], [0, 0.4], { extrapolateRight: "clamp" });

  const modalP = spring({ frame: frame - 10, fps, config: { damping: 180 } });
  const modalScale = interpolate(modalP, [0, 1], [0.92, 1]);
  const modalOpacity = interpolate(frame, [10, 24], [0, 1], { extrapolateRight: "clamp" });

  // Toggle animates to ON
  const toggleP = spring({ frame: frame - 55, fps, config: { damping: 200 } });
  const toggleX = interpolate(toggleP, [0, 1], [0, 18]);
  const toggleBg = interpolate(toggleP, [0, 1], [0, 1]);

  // Dropdown expands
  const dropdownP = spring({ frame: frame - 75, fps, config: { damping: 180 } });
  const dropdownHeight = interpolate(dropdownP, [0, 1], [0, 108]);
  const dropdownOpacity = interpolate(frame, [75, 90], [0, 1], { extrapolateRight: "clamp" });

  // Callout
  const calloutOpacity = interpolate(frame, [200, 216], [0, 1], { extrapolateRight: "clamp" });
  const calloutP = spring({ frame: frame - 200, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [14, 0]);

  return (
    <AbsoluteFill style={{ opacity, background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="יומן" />

      <div style={{
        position: "absolute",
        top: 0, right: 210, left: 0, bottom: 0,
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "white", opacity: 0.6 }} />

        <div style={{
          position: "absolute", inset: 0,
          background: `rgba(15,23,42,${backdropOpacity})`,
          zIndex: 2,
        }} />

        {/* Modal */}
        <div style={{
          position: "absolute",
          top: "50%", left: "50%",
          transform: `translate(-50%, -50%) scale(${modalScale})`,
          opacity: modalOpacity,
          zIndex: 3,
          background: "white",
          borderRadius: 18,
          padding: "28px 28px 24px",
          width: 400,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          direction: "rtl",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>הוסף תור</div>

          {[
            { label: "לקוח", value: "דנה לוי" },
            { label: "שירות", value: "אילוף — 60 דק׳" },
            { label: "תאריך", value: "14.04.2026" },
          ].map((f) => (
            <div key={f.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>{f.label}</div>
              <div style={{
                border: "1.5px solid #e2e8f0", borderRadius: 10,
                padding: "8px 12px", background: "#fafafa",
                fontSize: 13, color: "#0f172a",
              }}>{f.value}</div>
            </div>
          ))}

          {/* Recurring toggle */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 14, marginBottom: 10,
          }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>חוזר</span>
            <div style={{
              width: 44, height: 24, borderRadius: 12,
              background: toggleBg > 0.5 ? ORANGE : "#e2e8f0",
              position: "relative",
            }}>
              <div style={{
                position: "absolute",
                top: 3, right: 3,
                width: 18, height: 18, borderRadius: "50%",
                background: "white",
                transform: `translateX(-${toggleX}px)`,
                boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
              }} />
            </div>
          </div>

          {/* Frequency dropdown */}
          <div style={{
            height: dropdownHeight,
            overflow: "hidden",
            opacity: dropdownOpacity,
            marginBottom: 8,
          }}>
            <div style={{ border: "1.5px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              {FREQ_OPTIONS.map((opt, i) => (
                <div key={opt.label} style={{
                  padding: "10px 14px",
                  background: opt.selected ? "rgba(234,88,12,0.06)" : "white",
                  borderBottom: i < FREQ_OPTIONS.length - 1 ? "1px solid #f1f5f9" : "none",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 13, fontWeight: opt.selected ? 700 : 400, color: opt.selected ? ORANGE : "#475569" }}>{opt.label}</span>
                  {opt.selected && <span style={{ color: ORANGE, fontSize: 14 }}>✓</span>}
                </div>
              ))}
            </div>
          </div>

          <div style={{
            background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
            borderRadius: 12, padding: "12px 0",
            textAlign: "center",
            boxShadow: "0 4px 16px rgba(234,88,12,0.35)",
          }}>
            <span style={{ color: "white", fontSize: 15, fontWeight: 800 }}>שמור</span>
          </div>
        </div>

        {/* Callout */}
        <div style={{
          position: "absolute",
          bottom: 24, left: 24, right: 24,
          background: "rgba(234,88,12,0.08)",
          border: `1.5px solid rgba(234,88,12,0.25)`,
          borderRadius: 12, padding: "12px 18px",
          opacity: calloutOpacity,
          transform: `translateY(${calloutY}px)`,
          zIndex: 4,
        }}>
          <span style={{ fontSize: 13, color: ORANGE, fontWeight: 600 }}>
            קבעו סדרת תורים בבת אחת — שבועי, דו-שבועי, או חודשי
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
