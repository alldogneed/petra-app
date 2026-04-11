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

export const TrainingAddManualScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const modalProgress = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const modalY = interpolate(modalProgress, [0, 1], [30, 0]);
  const modalOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const field = (delay: number) => interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });

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
          width: 460,
          padding: "24px 28px",
          opacity: modalOpacity,
          transform: `translateY(${modalY}px)`,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          display: "flex", flexDirection: "column", gap: 16,
          direction: "rtl",
        }}>
          {/* Title */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>🎓</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הוסף תהליך אילוף ידני</div>
          </div>

          {/* Info banner */}
          <div style={{
            background: "#eff6ff", border: "1px solid #bfdbfe",
            borderRadius: 8, padding: "8px 12px",
            fontSize: 11, color: "#1d4ed8", fontWeight: 500,
            opacity: field(15),
          }}>
            להוספת לקוחות שכבר בתהליך אילוף ממערכת אחרת — ללא קישור להזמנה חדשה
          </div>

          {/* Client select */}
          <div style={{ opacity: field(25) }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>לקוח *</div>
            <div style={{
              border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px",
              fontSize: 13, color: "#0f172a", fontWeight: 600,
              background: "#fafafa", display: "flex", justifyContent: "space-between",
            }}>
              <span>ספיר מזרחי</span>
              <span style={{ color: "#94a3b8" }}>▾</span>
            </div>
          </div>

          {/* Training type */}
          <div style={{ opacity: field(42) }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>סוג אילוף</div>
            <div style={{
              border: `2px solid ${ORANGE}`, borderRadius: 8, padding: "9px 12px",
              fontSize: 13, color: "#0f172a", fontWeight: 600,
              background: "#fff7ed", display: "flex", justifyContent: "space-between",
            }}>
              <span>משמעת בסיסית</span>
              <span style={{ color: ORANGE }}>▾</span>
            </div>
          </div>

          {/* Sessions + date */}
          <div style={{ display: "flex", gap: 12, opacity: field(58) }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>מספר מפגשים</div>
              <div style={{
                border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px",
                fontSize: 13, color: "#0f172a", fontWeight: 600,
              }}>10</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>תאריך התחלה</div>
              <div style={{
                border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px",
                fontSize: 13, color: "#0f172a", fontWeight: 600,
              }}>08/04/2026</div>
            </div>
          </div>

          {/* Notes */}
          <div style={{ opacity: field(75) }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>הערות</div>
            <div style={{
              border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px",
              fontSize: 12, color: "#94a3b8", minHeight: 44,
            }}>
              הקשר, שלב התהליך לפני המעבר...
            </div>
          </div>

          {/* Add button */}
          <div style={{
            opacity: field(95),
            background: ORANGE, color: "white",
            borderRadius: 10, padding: "12px",
            fontSize: 14, fontWeight: 800, textAlign: "center",
            boxShadow: "0 4px 14px rgba(234,88,12,0.35)",
          }}>
            + הוסף תהליך
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
