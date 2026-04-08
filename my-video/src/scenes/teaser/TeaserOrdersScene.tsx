// src/scenes/teaser/TeaserOrdersScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "../PetraSidebar";
import { PainOverlay } from "../../components/teaser/PainOverlay";
import { BenefitTag } from "../../components/teaser/BenefitTag";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const ITEMS = [
  { label: "לינה פנסיון", sub: "3 לילות × ₪150", total: "₪450", delay: 75 },
  { label: "אילוף גורים", sub: "מנוי חודשי", total: "₪350", delay: 90 },
  { label: "טיפוח", sub: "חיתוך + אמבטיה", total: "₪120", delay: 105 },
];

export const TeaserOrdersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const modalProgress = spring({ frame: frame - 52, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.93, 1]);
  const modalOpacity = interpolate(frame, [52, 65], [0, 1], { extrapolateRight: "clamp" });

  const paidOpacity = interpolate(frame, [118, 130], [0, 1], { extrapolateRight: "clamp" });
  const paidScale = spring({ frame: frame - 118, fps, config: { damping: 160, stiffness: 280 } });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="פיננסים" />

      <div style={{
        position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(15,23,42,0.35)",
        opacity: modalOpacity,
      }}>
        <div style={{
          background: "white", borderRadius: 20,
          padding: "28px 32px", width: 480,
          transform: `scale(${modalScale})`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          direction: "rtl",
          position: "relative",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 20 }}>
            הזמנה חדשה — ענבל כהן
          </div>

          {/* Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {ITEMS.map((item) => {
              const p = spring({ frame: frame - item.delay, fps, config: { damping: 200 } });
              const y = interpolate(p, [0, 1], [12, 0]);
              const itemOpacity = interpolate(frame, [item.delay, item.delay + 10], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={item.label} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 10,
                  border: "1.5px solid #e2e8f0",
                  opacity: itemOpacity, transform: `translateY(${y}px)`,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{item.label}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{item.sub}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: ORANGE }}>{item.total}</div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            borderTop: "1.5px solid #f1f5f9", paddingTop: 14, marginBottom: 16,
            opacity: interpolate(frame, [110, 120], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            <span style={{ fontSize: 14, color: "#64748b" }}>סה"כ לתשלום</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>₪920</span>
          </div>

          {/* Paid badge */}
          <div style={{
            opacity: paidOpacity,
            transform: `scale(${paidScale})`,
            background: "#dcfce7", border: "1.5px solid #86efac",
            borderRadius: 12, padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 20 }}>✓</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#15803d" }}>שולם בהצלחה</span>
            <span style={{ fontSize: 11, color: "#16a34a", marginRight: "auto" }}>חשבונית נשלחה בWhatsApp</span>
          </div>
        </div>
      </div>

      <PainOverlay text="מי שילם? מי חייב?" fadeOutStart={35} fadeOutEnd={52} />
      <BenefitTag text="הזמנה + חשבונית בלחיצה" appearAt={68} />
    </AbsoluteFill>
  );
};
