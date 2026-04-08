// src/scenes/teaser/TeaserBookingScene.tsx
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PainOverlay } from "../../components/teaser/PainOverlay";
import { BenefitTag } from "../../components/teaser/BenefitTag";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";

const SERVICES = [
  { label: "אילוף גורים", price: "₪350/חודש", selected: false, delay: 58 },
  { label: "פנסיון", price: "₪150/לילה", selected: true, delay: 66 },
  { label: "טיפוח", price: "₪120", selected: false, delay: 74 },
];

const SLOTS = ["09:00", "10:30", "12:00", "14:00", "15:30"];

export const TeaserBookingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [50, 62], [0, 1], { extrapolateRight: "clamp" });
  const slotsOpacity = interpolate(frame, [80, 92], [0, 1], { extrapolateRight: "clamp" });
  const btnOpacity = interpolate(frame, [95, 108], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      {/* Public booking page — no sidebar */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center",
      }}>
        {/* Top bar */}
        <div style={{
          width: "100%", background: "white",
          borderBottom: "1px solid #e2e8f0",
          padding: "0 32px", height: 56,
          display: "flex", alignItems: "center",
          gap: 10, opacity: headerOpacity,
        }}>
          <Img src={staticFile("petra-icon.png")} style={{ width: 28, height: 28 }} />
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>הזמנה אונליין — כלבית הכלב המאושר</span>
        </div>

        {/* Content */}
        <div style={{
          width: 520, marginTop: 24,
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          {/* Service selection */}
          <div style={{
            background: "white", borderRadius: 16,
            border: "1px solid #e2e8f0", padding: "20px 24px",
            opacity: headerOpacity,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 12 }}>בחר שירות</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {SERVICES.map((svc) => {
                const p = spring({ frame: frame - svc.delay, fps, config: { damping: 200 } });
                const y = interpolate(p, [0, 1], [10, 0]);
                const svcOpacity = interpolate(frame, [svc.delay, svc.delay + 10], [0, 1], { extrapolateRight: "clamp" });
                return (
                  <div key={svc.label} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: 10,
                    border: `2px solid ${svc.selected ? ORANGE : "#e2e8f0"}`,
                    background: svc.selected ? "#fff7ed" : "white",
                    opacity: svcOpacity, transform: `translateY(${y}px)`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        border: `2px solid ${svc.selected ? ORANGE : "#cbd5e1"}`,
                        background: svc.selected ? ORANGE : "white",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {svc.selected && <div style={{ width: 6, height: 6, background: "white", borderRadius: "50%" }} />}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{svc.label}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{svc.price}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time slots */}
          <div style={{
            background: "white", borderRadius: 16,
            border: "1px solid #e2e8f0", padding: "20px 24px",
            opacity: slotsOpacity,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 12 }}>בחר שעה — יום שני 7.4</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SLOTS.map((slot, i) => (
                <div key={slot} style={{
                  padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: i === 2 ? ORANGE : "#f1f5f9",
                  color: i === 2 ? "white" : "#475569",
                  border: `1px solid ${i === 2 ? ORANGE : "#e2e8f0"}`,
                }}>
                  {slot}
                </div>
              ))}
            </div>
          </div>

          {/* Book button */}
          <div style={{
            background: ORANGE, borderRadius: 12,
            padding: "14px", textAlign: "center",
            fontSize: 16, fontWeight: 800, color: "white",
            opacity: btnOpacity,
            boxShadow: "0 4px 20px rgba(234,88,12,0.4)",
          }}>
            אשר הזמנה
          </div>
        </div>
      </div>

      <PainOverlay text="הלקוחות מחכים לאישור ידני" fadeOutStart={35} fadeOutEnd={52} />
      <BenefitTag text="הזמנות אונליין 24/7" appearAt={68} />
    </AbsoluteFill>
  );
};
