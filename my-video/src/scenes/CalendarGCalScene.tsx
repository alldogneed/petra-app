// src/scenes/CalendarGCalScene.tsx
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_WIDTH = 210;
const GCAL_BLUE = "#1a73e8";
const GCAL_GREEN = "#0f9d58";

export const CalendarGCalScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Header
  const headerOpacity = interpolate(frame, [8, 22], [0, 1], { extrapolateRight: "clamp" });
  const headerP = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const headerY = interpolate(headerP, [0, 1], [-16, 0]);

  // Petra card
  const petraCardOpacity = interpolate(frame, [35, 50], [0, 1], { extrapolateRight: "clamp" });
  const petraCardP = spring({ frame: frame - 35, fps, config: { damping: 180 } });
  const petraCardX = interpolate(petraCardP, [0, 1], [40, 0]);

  // GCal card
  const gcalCardOpacity = interpolate(frame, [55, 70], [0, 1], { extrapolateRight: "clamp" });
  const gcalCardP = spring({ frame: frame - 55, fps, config: { damping: 180 } });
  const gcalCardX = interpolate(gcalCardP, [0, 1], [-40, 0]);

  // Sync arrows
  const arrowOpacity = interpolate(frame, [75, 90], [0, 1], { extrapolateRight: "clamp" });
  const arrowPulse = interpolate(frame % 45, [0, 22, 45], [0.55, 1, 0.55]);

  // Booking section
  const bookingOpacity = interpolate(frame, [155, 172], [0, 1], { extrapolateRight: "clamp" });
  const bookingP = spring({ frame: frame - 155, fps, config: { damping: 200 } });
  const bookingY = interpolate(bookingP, [0, 1], [28, 0]);

  // Callout
  const calloutOpacity = interpolate(frame, [265, 278], [0, 1], { extrapolateRight: "clamp" });
  const calloutP = spring({ frame: frame - 265, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [12, 0]);

  return (
    <AbsoluteFill style={{ opacity, background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="הגדרות" />

      {/* Content area */}
      <div style={{
        position: "absolute",
        top: 0, bottom: 0, right: SIDEBAR_WIDTH, left: 0,
        display: "flex", flexDirection: "column",
        padding: "28px 36px",
        gap: 18,
      }}>

        {/* Header */}
        <div style={{ opacity: headerOpacity, transform: `translateY(${headerY}px)`, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "white", border: "1px solid #e2e8f0",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {/* Google-style "G" */}
            <span style={{ fontSize: 18, fontWeight: 800, color: GCAL_BLUE, lineHeight: 1 }}>G</span>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
              סנכרון Google Calendar
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: GCAL_GREEN }} />
              <span style={{ fontSize: 12, color: GCAL_GREEN, fontWeight: 600 }}>מחובר</span>
            </div>
          </div>
        </div>

        {/* Sync visualization */}
        <div style={{
          background: "white",
          borderRadius: 14, border: "1px solid #e2e8f0",
          padding: "20px 24px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 20,
        }}>

          {/* Petra card */}
          <div style={{
            opacity: petraCardOpacity, transform: `translateX(${petraCardX}px)`,
            background: "#fff7ed", border: `2px solid ${ORANGE}`,
            borderRadius: 12, padding: "14px 18px", flex: 1,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Img src={staticFile("petra-icon.png")} style={{ width: 18, height: 18, objectFit: "contain" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: ORANGE }}>יומן פטרה</span>
            </div>
            <div style={{ background: ORANGE, borderRadius: 8, padding: "10px 14px", color: "white" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>אילוף — דנה לוי</div>
              <div style={{ fontSize: 11, opacity: 0.9, marginTop: 3 }}>14.04.2026 · 09:00–10:00</div>
            </div>
          </div>

          {/* Sync arrows */}
          <div style={{
            opacity: arrowOpacity,
            transform: `scale(${arrowPulse})`,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            flexShrink: 0, minWidth: 72,
          }}>
            <div style={{ display: "flex", gap: 4, color: "#64748b" }}>
              <div style={{ fontSize: 16, color: "#94a3b8" }}>←</div>
              <div style={{ fontSize: 16, color: "#94a3b8" }}>→</div>
            </div>
            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}>
              סנכרון אוטומטי
            </span>
          </div>

          {/* GCal card */}
          <div style={{
            opacity: gcalCardOpacity, transform: `translateX(${gcalCardX}px)`,
            background: "#eff6ff", border: `2px solid ${GCAL_BLUE}`,
            borderRadius: 12, padding: "14px 18px", flex: 1,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                background: GCAL_BLUE,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: "white", lineHeight: 1 }}>G</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: GCAL_BLUE }}>Google Calendar</span>
            </div>
            <div style={{ background: GCAL_BLUE, borderRadius: 8, padding: "10px 14px", color: "white" }}>
              <div style={{ fontSize: 13, fontWeight: 700, direction: "ltr", textAlign: "left" }}>אילוף — דנה לוי</div>
              <div style={{ fontSize: 11, opacity: 0.9, marginTop: 3, direction: "ltr", textAlign: "left" }}>Apr 14, 2026 · 9:00–10:00</div>
            </div>
          </div>
        </div>

        {/* Booking blocked section */}
        <div style={{
          opacity: bookingOpacity, transform: `translateY(${bookingY}px)`,
          background: "white", borderRadius: 14, border: "1px solid #e2e8f0",
          padding: "16px 24px",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 12 }}>
            הזמנה עצמית — תצוגת לקוח
          </div>
          <div style={{ display: "flex", gap: 10, direction: "ltr" }}>
            {[
              { time: "08:00", blocked: false },
              { time: "09:00", blocked: true },
              { time: "10:00", blocked: false },
              { time: "11:00", blocked: false },
            ].map(({ time, blocked }) => (
              <div key={time} style={{
                borderRadius: 10, padding: "10px 18px",
                background: blocked ? "#f8fafc" : "#fff7ed",
                border: `1px solid ${blocked ? "#cbd5e1" : ORANGE}`,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                opacity: blocked ? 0.55 : 1,
                minWidth: 72,
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: blocked ? "#94a3b8" : ORANGE }}>{time}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: blocked ? "#94a3b8" : ORANGE }}>
                  {blocked ? "תפוס" : "פנוי"}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#cbd5e1", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "#94a3b8" }}>09:00 חסום — קיים אירוע בגוגל קלנדר</span>
          </div>
        </div>

        {/* Callout */}
        <div style={{
          opacity: calloutOpacity, transform: `translateY(${calloutY}px)`,
          background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
          borderRadius: 12, padding: "12px 20px",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <div style={{ width: 8, height: 10, background: "white", borderRadius: 1 }} />
          </div>
          <span style={{ color: "white", fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>
            אירועי גוגל קלנדר חוסמים זמינות אוטומטית — הלקוחות לא יוכלו להזמין בזמן תפוס
          </span>
        </div>

      </div>
    </AbsoluteFill>
  );
};
