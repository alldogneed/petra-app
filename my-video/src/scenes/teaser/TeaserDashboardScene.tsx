// src/scenes/teaser/TeaserDashboardScene.tsx
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
import { CursorAnimation } from "../../components/teaser/CursorAnimation";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const STAT_CARDS = [
  { label: "הכנסות החודש", value: "₪18,240", sub: "↑ 23% מחודש שעבר", color: "#ea580c", delay: 52 },
  { label: "תורים השבוע", value: "34", sub: "8 להיום", color: "#3b82f6", delay: 62 },
  { label: "לידים חדשים", value: "11", sub: "3 ממתינים למענה", color: "#8b5cf6", delay: 72 },
  { label: "לקוחות פעילים", value: "127", sub: "↑ 5 החודש", color: "#10b981", delay: 82 },
];

// Bar chart data — monthly revenue (6 months)
const BAR_DATA = [
  { label: "נוב׳", value: 58 },
  { label: "דצ׳", value: 72 },
  { label: "ינו׳", value: 65 },
  { label: "פבר׳", value: 80 },
  { label: "מרץ", value: 88 },
  { label: "אפר׳", value: 100 },
];

const CHART_START = 88;

export const TeaserDashboardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [52, 65], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(frame, [52, 70], [0, 3.5], { extrapolateRight: "clamp" });

  const zoomP = spring({ frame: frame - 54, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.13]);

  return (
    <AbsoluteFill style={{ background: "#f8fafc", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
        <PetraSidebar width={SIDEBAR_W} activeLabel="דשבורד" />
      </div>

      {/* Zoomable content */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "55% 35%", width: "100%", height: "100%" }}>

          {/* Header */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            padding: "0 24px", height: 52,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            opacity: headerOpacity,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>דשבורד</div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>אפריל 2026</div>
          </div>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: "16px 24px 12px" }}>
            {STAT_CARDS.map((card) => {
              const cardOpacity = interpolate(frame, [card.delay, card.delay + 12], [0, 1], { extrapolateRight: "clamp" });
              const p = spring({ frame: frame - card.delay, fps, config: { damping: 200 } });
              const y = interpolate(p, [0, 1], [12, 0]);

              // Animated number counter for first card
              const isRevenue = card.delay === 52;
              const countP = isRevenue
                ? interpolate(frame, [card.delay + 5, card.delay + 40], [0, 1], { extrapolateRight: "clamp" })
                : 1;
              const displayValue = isRevenue
                ? `₪${Math.round(18240 * countP).toLocaleString()}`
                : card.value;

              // Glow on first card
              const glowP = isRevenue ? interpolate(frame, [card.delay + 10, card.delay + 38], [0, 1], { extrapolateRight: "clamp" }) : 0;
              const glowOpacity = isRevenue ? interpolate(glowP, [0, 0.35, 1], [0, 1, 0]) : 0;

              return (
                <div key={card.label} style={{
                  background: "white", borderRadius: 12,
                  border: "1px solid #e2e8f0", padding: "12px 14px",
                  opacity: cardOpacity, transform: `translateY(${y}px)`,
                  boxShadow: glowOpacity > 0.05 ? `0 0 18px rgba(234,88,12,${glowOpacity * 0.45})` : "0 1px 3px rgba(0,0,0,0.04)",
                }}>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{card.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: card.color }}>{displayValue}</div>
                  <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 3 }}>{card.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Revenue chart */}
          <div style={{
            margin: "0 24px",
            background: "white", borderRadius: 12,
            border: "1px solid #e2e8f0", padding: "16px 20px",
            opacity: interpolate(frame, [CHART_START, CHART_START + 12], [0, 1], { extrapolateRight: "clamp" }),
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>הכנסות — 6 חודשים אחרונים</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 90 }}>
              {BAR_DATA.map((bar, i) => {
                const barDelay = CHART_START + 8 + i * 7;
                const barP = spring({ frame: frame - barDelay, fps, config: { damping: 160, stiffness: 120 } });
                const barH = interpolate(barP, [0, 1], [0, bar.value * 0.82]);
                const isLast = i === BAR_DATA.length - 1;

                return (
                  <div key={bar.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{
                      width: "100%", height: `${barH}px`,
                      background: isLast ? ORANGE : "#e2e8f0",
                      borderRadius: "4px 4px 0 0",
                      boxShadow: isLast ? "0 0 12px rgba(234,88,12,0.35)" : "none",
                    }} />
                    <div style={{ fontSize: 8, color: isLast ? ORANGE : "#94a3b8", fontWeight: isLast ? 700 : 400 }}>{bar.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      <CursorAnimation
        startX={640} startY={460}
        endX={830} endY={148}
        appearAt={60}
        clickAt={95}
      />

      <PainOverlay text="בלי מושג מה קורה בעסק" fadeOutStart={35} fadeOutEnd={52} />
      <BenefitTag text="תמונה מלאה — בשנייה אחת" appearAt={68} />
    </AbsoluteFill>
  );
};
