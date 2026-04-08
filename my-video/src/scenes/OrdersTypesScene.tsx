import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

const ORDER_TYPES = [
  {
    id: "training",
    label: "אילוף",
    icon: "🐾",
    subLabel: "יוצר תהליך אילוף אוטומטית",
    gradient: "linear-gradient(135deg, #6366f1, #4f46e5)",
    delay: 30,
  },
  {
    id: "boarding",
    label: "פנסיון",
    icon: "🏠",
    subLabel: "פותח חדר בפנסיון אוטומטית",
    gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
    delay: 50,
  },
  {
    id: "grooming",
    label: "טיפוח",
    icon: "✂️",
    subLabel: "קובע תור ביומן",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    delay: 70,
  },
  {
    id: "products",
    label: "מוצרים",
    icon: "🛒",
    subLabel: "מכירה ישירה",
    gradient: "linear-gradient(135deg, #64748b, #475569)",
    delay: 90,
  },
];

export const OrdersTypesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const modalOpacity = interpolate(frame, [10, 22], [0, 1], { extrapolateRight: "clamp" });
  const modalProgress = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.94, 1]);

  // Highlight ring cycles through types after all are shown
  const highlightIndex = Math.floor(
    interpolate(frame, [110, 350], [0, ORDER_TYPES.length], { extrapolateRight: "clamp" })
  ) % ORDER_TYPES.length;

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="פיננסים" />

      {/* Content area */}
      <div style={{
        position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0,
        display: "flex", flexDirection: "column",
      }}>
        {/* Topbar */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הזמנות</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>ניהול הזמנות ושירותים</div>
          </div>
          <div style={{
            background: "#ea580c", color: "white",
            borderRadius: 8, padding: "7px 16px",
            fontSize: 12, fontWeight: 700,
          }}>
            + הזמנה חדשה
          </div>
        </div>

        {/* Modal overlay */}
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(15,23,42,0.45)",
          opacity: modalOpacity,
        }}>
          <div style={{
            background: "white",
            borderRadius: 20,
            padding: "32px 36px",
            width: 560,
            transform: `scale(${modalScale})`,
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            direction: "rtl",
          }}>
            {/* Modal header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>הזמנה חדשה</div>
              <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>בחרו את סוג ההזמנה</div>
            </div>

            {/* 2×2 grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {ORDER_TYPES.map((type, i) => {
                const cardProgress = spring({ frame: frame - type.delay, fps, config: { damping: 200 } });
                const cardOpacity = interpolate(frame, [type.delay, type.delay + 14], [0, 1], { extrapolateRight: "clamp" });
                const cardScale = interpolate(cardProgress, [0, 1], [0.85, 1]);
                const isHighlighted = frame > 110 && highlightIndex === i;

                return (
                  <div key={type.id} style={{
                    opacity: cardOpacity,
                    transform: `scale(${cardScale})`,
                    borderRadius: 14,
                    padding: "20px 18px",
                    background: isHighlighted ? type.gradient : "white",
                    border: isHighlighted
                      ? "2px solid transparent"
                      : "2px solid #e2e8f0",
                    cursor: "pointer",
                    boxShadow: isHighlighted ? "0 6px 20px rgba(0,0,0,0.15)" : "none",
                    display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <span style={{ fontSize: 28 }}>{type.icon}</span>
                    <div style={{
                      fontSize: 16, fontWeight: 800,
                      color: isHighlighted ? "white" : "#0f172a",
                    }}>
                      {type.label}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: isHighlighted ? "rgba(255,255,255,0.8)" : "#94a3b8",
                      lineHeight: 1.4,
                    }}>
                      {type.subLabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
