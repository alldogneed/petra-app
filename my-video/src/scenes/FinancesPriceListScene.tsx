import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const ORANGE = "#ea580c";

const CATEGORIES = [
  {
    name: "פנסיון",
    items: [
      { name: "יום בפנסיון", price: "₪100", unit: "ליום", vat: true, delay: 28 },
      { name: "לילה בפנסיון", price: "₪100", unit: "ליום", vat: false, delay: 38 },
    ],
    delay: 22,
  },
  {
    name: "אילוף",
    items: [
      { name: "פגישת אילוף", price: "₪350", unit: "לפגישה", duration: "60'", vat: false, delay: 52 },
      { name: "אילוף בבית הלקוח", price: "₪400", unit: "לפגישה", duration: "90'", vat: false, delay: 62 },
      { name: "אילוף קבוצתי", price: "₪1,800", unit: "מחיר קבוע", vat: true, delay: 72 },
    ],
    delay: 46,
  },
  {
    name: "טיפוח",
    items: [
      { name: "טיפוח בסיסי", price: "₪200", unit: "לפגישה", duration: "60'", vat: false, delay: 86 },
    ],
    delay: 80,
  },
];

export const FinancesPriceListScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const btnOpacity = interpolate(frame, [12, 22], [0, 1], { extrapolateRight: "clamp" });

  // "First step" badge
  const badgeOpacity = interpolate(frame, [8, 18], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="פיננסים" />

      <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Tabs bar */}
        <div
          style={{
            background: "white",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: 0,
            opacity: headerOpacity,
          }}
        >
          {["מחירון", "הזמנות", "בקשות תשלום", "תשלומים"].map((tab, i) => (
            <div
              key={tab}
              style={{
                padding: "14px 24px",
                fontSize: 13,
                fontWeight: i === 0 ? 700 : 500,
                color: i === 0 ? ORANGE : "#64748b",
                borderBottom: i === 0 ? `2px solid ${ORANGE}` : "2px solid transparent",
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", padding: "20px 28px" }}>
          {/* Header row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 20,
              opacity: headerOpacity,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>מחירון</h1>
              <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>ניהול שירותים ומוצרים לפי קטגוריות</p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* First-step badge */}
              <div
                style={{
                  opacity: badgeOpacity,
                  background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                  border: "1px solid #f59e0b",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#92400e",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                צעד ראשון בהקמה
              </div>

              <div
                style={{
                  opacity: btnOpacity,
                  background: ORANGE,
                  color: "white",
                  borderRadius: 8,
                  padding: "9px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(234,88,12,0.35)",
                }}
              >
                <span style={{ fontSize: 16 }}>+</span>
                הוסף פריט
              </div>
            </div>
          </div>

          {/* Price list */}
          <div
            style={{
              background: "white",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
          >
            {CATEGORIES.map((cat, ci) => {
              const catOpacity = interpolate(frame, [cat.delay, cat.delay + 10], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={cat.name} style={{ opacity: catOpacity }}>
                  {/* Category header */}
                  <div
                    style={{
                      background: "#f8fafc",
                      borderBottom: "1px solid #e2e8f0",
                      ...(ci > 0 ? { borderTop: "1px solid #e2e8f0" } : {}),
                      padding: "8px 16px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>{cat.name}</span>
                    <span
                      style={{
                        fontSize: 10,
                        background: "#e2e8f0",
                        color: "#64748b",
                        borderRadius: 99,
                        padding: "1px 7px",
                        fontWeight: 600,
                      }}
                    >
                      {cat.items.length}
                    </span>
                  </div>

                  {/* Items */}
                  {cat.items.map((item) => {
                    const iOpacity = interpolate(frame, [item.delay, item.delay + 12], [0, 1], { extrapolateRight: "clamp" });
                    return (
                      <div
                        key={item.name}
                        style={{
                          opacity: iOpacity,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "10px 16px",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        {/* Left: price */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", minWidth: 70 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{item.price}</span>
                          {item.vat && (
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>כולל מע"מ</span>
                          )}
                        </div>

                        {/* Right: name + details */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flex: 1, marginRight: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{item.name}</span>
                            {item.duration && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "#64748b",
                                  background: "#f1f5f9",
                                  borderRadius: 4,
                                  padding: "2px 5px",
                                }}
                              >
                                {item.duration}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                            <span style={{ fontSize: 10, color: "#94a3b8" }}>{item.unit}</span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: "flex", gap: 6, marginRight: 8 }}>
                          {["✕", "✓", "⧉", "✎"].map((icon) => (
                            <div
                              key={icon}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 6,
                                background: "#f8fafc",
                                border: "1px solid #e2e8f0",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                color: "#64748b",
                                cursor: "pointer",
                              }}
                            >
                              {icon}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
