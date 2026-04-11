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
import { CursorAnimation } from "../../components/teaser/CursorAnimation";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const STAT_CARDS = [
  { label: "סכום כולל", value: "₪12,450", sub: "החודש", color: "#ea580c", delay: 52 },
  { label: "הזמנות פתוחות", value: "8", sub: "ממתינות", color: "#3b82f6", delay: 60 },
  { label: "ממתינות לתשלום", value: "3", sub: "₪1,870", color: "#f59e0b", delay: 68 },
  { label: "הושלמו החודש", value: "24", sub: "הזמנות", color: "#10b981", delay: 76 },
];

const ORDERS = [
  { name: "ענבל כהן", service: "פנסיון — 3 לילות", amount: "₪450", status: "הושלמה", statusColor: "#10b981", statusBg: "#ecfdf5", delay: 82 },
  { name: "יוסי גולן", service: "אילוף גורים — מנוי", amount: "₪350", status: "פתוחה", statusColor: "#3b82f6", statusBg: "#eff6ff", delay: 92 },
  { name: "מיכל לוי", service: "טיפוח", amount: "₪120", status: "ממתינה", statusColor: "#f59e0b", statusBg: "#fffbeb", delay: 100 },
  { name: "עמית שפירא", service: "אילוף גורים — 4 שיעורים", amount: "₪680", status: "הושלמה", statusColor: "#10b981", statusBg: "#ecfdf5", delay: 108 },
];

export const TeaserOrdersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [52, 65], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(frame, [52, 70], [0, 3.5], { extrapolateRight: "clamp" });

  // Zoom toward stat cards
  const zoomP = spring({ frame: frame - 54, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.13]);

  return (
    <AbsoluteFill style={{ background: "#f8fafc", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar with blur */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
        <PetraSidebar width={SIDEBAR_W} activeLabel="פיננסים" />
      </div>

      {/* Zoomable content */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "68% 32%", width: "100%", height: "100%" }}>

          {/* Header */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            padding: "0 24px", height: 52,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            opacity: headerOpacity, flexShrink: 0,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הזמנות</div>
            <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>
              + הזמנה חדשה
            </div>
          </div>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: "16px 24px 12px", flexShrink: 0 }}>
            {STAT_CARDS.map((card) => {
              const cardOpacity = interpolate(frame, [card.delay, card.delay + 12], [0, 1], { extrapolateRight: "clamp" });
              const p = spring({ frame: frame - card.delay, fps, config: { damping: 200 } });
              const y = interpolate(p, [0, 1], [10, 0]);

              // Glow on first stat card
              const isFirst = card.delay === 52;
              const glowP = isFirst ? interpolate(frame, [card.delay + 10, card.delay + 35], [0, 1], { extrapolateRight: "clamp" }) : 0;
              const glowOpacity = isFirst ? interpolate(glowP, [0, 0.3, 1], [0, 1, 0]) : 0;

              return (
                <div key={card.label} style={{
                  background: "white", borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "12px 14px",
                  opacity: cardOpacity, transform: `translateY(${y}px)`,
                  boxShadow: glowOpacity > 0.05 ? `0 0 16px rgba(234,88,12,${glowOpacity * 0.45})` : "none",
                }}>
                  <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>{card.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: card.color }}>{card.value}</div>
                  <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2 }}>{card.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Orders list */}
          <div style={{ margin: "0 24px 16px", background: "white", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "8px 16px" }}>
              {["לקוח", "שירות", "סכום", "סטטוס"].map((h) => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8" }}>{h}</div>
              ))}
            </div>

            {ORDERS.map((order, i) => {
              const rowOpacity = interpolate(frame, [order.delay, order.delay + 10], [0, 1], { extrapolateRight: "clamp" });
              const p = spring({ frame: frame - order.delay, fps, config: { damping: 200 } });
              const y = interpolate(p, [0, 1], [8, 0]);
              return (
                <div key={order.name} style={{
                  display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr",
                  padding: "10px 16px",
                  borderBottom: i < ORDERS.length - 1 ? "1px solid #f1f5f9" : "none",
                  alignItems: "center",
                  opacity: rowOpacity, transform: `translateY(${y}px)`,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{order.name}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{order.service}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{order.amount}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, background: order.statusBg, color: order.statusColor, borderRadius: 6, padding: "2px 7px", display: "inline-block" }}>
                    {order.status}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cursor clicks on revenue stat card */}
      <CursorAnimation
        startX={640} startY={460}
        endX={920} endY={138}
        appearAt={60}
        clickAt={88}
      />

      <PainOverlay text="מי שילם? מי חייב?" fadeOutStart={35} fadeOutEnd={52} />
      <BenefitTag text="הזמנה + חשבונית בלחיצה" appearAt={68} />
    </AbsoluteFill>
  );
};
