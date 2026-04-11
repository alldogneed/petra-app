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
const SIDEBAR_W = 210;

export const TrainingLogSessionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const modalProgress = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const modalY = interpolate(modalProgress, [0, 1], [30, 0]);
  const modalOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  // Fields animate in sequentially
  const field = (delay: number) => interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });

  // Stars animate in
  const starsOpacity = field(45);
  const starFill = Math.min(Math.floor(interpolate(frame, [60, 100], [0, 5], { extrapolateRight: "clamp" })), 5);

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול תהליכי אילוף" />

      {/* Dimmed background */}
      <div style={{
        position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0,
        background: "rgba(15,23,42,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* Modal */}
        <div style={{
          background: "white", borderRadius: 16,
          width: 480, maxHeight: 560,
          padding: "24px 28px",
          opacity: modalOpacity,
          transform: `translateY(${modalY}px)`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          display: "flex", flexDirection: "column", gap: 14,
          direction: "rtl",
        }}>
          {/* Badge + title */}
          <div style={{ textAlign: "center" }}>
            <div style={{
              display: "inline-block",
              background: "#fff7ed", border: "1px solid #fed7aa",
              borderRadius: 99, padding: "4px 14px",
              fontSize: 12, fontWeight: 700, color: ORANGE, marginBottom: 8,
            }}>
              מפגש מספר 2
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>רישום מפגש — כוכב</div>
          </div>

          {/* Date + duration */}
          <div style={{ display: "flex", gap: 12, opacity: field(20) }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>תאריך המפגש</div>
              <div style={{
                border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px",
                fontSize: 13, color: "#0f172a", fontWeight: 600,
              }}>08/04/2026</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>משך (דקות)</div>
              <div style={{
                border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px",
                fontSize: 13, color: "#0f172a", fontWeight: 600,
              }}>60</div>
            </div>
          </div>

          {/* Star rating */}
          <div style={{ opacity: starsOpacity }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600 }}>דירוג הכלב במפגש (אופציונלי)</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <span key={s} style={{
                  fontSize: 24,
                  color: s <= starFill ? "#f59e0b" : "#e2e8f0",
                  transition: "color 0.2s",
                }}>★</span>
              ))}
            </div>
          </div>

          {/* Text fields */}
          {[
            { label: "תרגילים שבוצעו", placeholder: "אילו תרגילים עשיתם היום...", delay: 70, value: "ישיבה, שכיבה, הישאר — 5 חזרות כל אחד" },
            { label: "יעדים לפגישה הבאה", placeholder: "מה תעבדו בפגישה הבאה...", delay: 90, value: "עיבוד בסחיבה, הליכה ליד הרגל" },
            { label: "שיעורי בית ללקוח", placeholder: "תרגול לבית...", delay: 110, value: "5 דקות ישיבה עם הסחת דעת, 2 פעמים ביום" },
          ].map((f) => (
            <div key={f.label} style={{ opacity: field(f.delay) }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>{f.label}</div>
              <div style={{
                border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px",
                fontSize: 12, color: f.value ? "#0f172a" : "#94a3b8", minHeight: 36,
                background: f.value ? "#fafafa" : "white",
              }}>
                {f.value || f.placeholder}
              </div>
            </div>
          ))}

          {/* Save button */}
          <div style={{
            opacity: field(130),
            background: ORANGE, color: "white",
            borderRadius: 10, padding: "12px",
            fontSize: 14, fontWeight: 800, textAlign: "center",
            boxShadow: "0 4px 14px rgba(234,88,12,0.35)",
          }}>
            שמור מפגש
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
