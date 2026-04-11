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
const ORANGE = "#ea580c";

const SERVICES = [
  { name: "אילוף קבוצתי", price: "₪1,800", category: "אילוף", delay: 68 },
  { name: "אילוף בבית הלקוח", price: "₪400", category: "אילוף", delay: 68 },
  { name: "טיפוח בסיסי", price: "₪200", category: "טיפוח", delay: 68 },
  { name: "יום בפנסיון", price: "₪100", category: "פנסיון", delay: 68 },
];

export const FinancesPaymentRequestScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const customerOpacity = interpolate(frame, [22, 36], [0, 1], { extrapolateRight: "clamp" });
  const customerSelected = interpolate(frame, [40, 50], [0, 1], { extrapolateRight: "clamp" });
  const servicesOpacity = interpolate(frame, [55, 68], [0, 1], { extrapolateRight: "clamp" });

  // Item 1 added to summary at frame 80
  const item1Added = interpolate(frame, [80, 90], [0, 1], { extrapolateRight: "clamp" });
  const summaryOpacity = interpolate(frame, [78, 92], [0, 1], { extrapolateRight: "clamp" });

  const sendHighlight = interpolate(frame, [108, 122], [0, 1], { extrapolateRight: "clamp" });
  const sendScale = interpolate(
    spring({ frame: frame - 108, fps, config: { damping: 200 } }),
    [0, 1],
    [0.92, 1]
  );

  const toastOpacity = interpolate(frame, [130, 142], [0, 1], { extrapolateRight: "clamp" });
  const toastY = interpolate(
    spring({ frame: frame - 130, fps, config: { damping: 200 } }),
    [0, 1],
    [20, 0]
  );

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="פיננסים" />

      <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Tabs */}
        <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", display: "flex", opacity: headerOpacity }}>
          {[
            { tab: "מחירון", active: false },
            { tab: "הזמנות", active: false },
            { tab: "בקשות תשלום", active: true },
            { tab: "תשלומים", active: false },
          ].map(({ tab, active }) => (
            <div
              key={tab}
              style={{
                padding: "14px 20px",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                color: active ? ORANGE : "#64748b",
                borderBottom: active ? `2px solid ${ORANGE}` : "2px solid transparent",
                whiteSpace: "nowrap",
              }}
            >
              {tab}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "hidden", padding: "20px 28px" }}>
          {/* Header */}
          <div style={{ marginBottom: 18, opacity: headerOpacity, textAlign: "right" }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>בקשת תשלום</h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>בחר לקוח, הוסף מוצרים ושלח בקשת תשלום בוואטסאפ</p>
          </div>

          <div style={{ display: "flex", gap: 20, height: "calc(100% - 80px)" }}>
            {/* Right panel */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Customer search */}
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "16px 18px",
                  opacity: customerOpacity,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>בחירת לקוח</span>
                </div>
                <div
                  style={{
                    background: customerSelected > 0.5 ? "#fff7ed" : "#f8fafc",
                    border: `1.5px solid ${customerSelected > 0.5 ? ORANGE : "#e2e8f0"}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: customerSelected > 0.5 ? ORANGE : "#94a3b8",
                    fontWeight: customerSelected > 0.5 ? 600 : 400,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {customerSelected > 0.5 ? (
                    <>
                      <span>✓</span>
                      <span>ספיר מזרחי — 050-3333333</span>
                    </>
                  ) : (
                    <span>חפש לקוח לפי שם או טלפון...</span>
                  )}
                </div>
              </div>

              {/* Services grid */}
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "16px 18px",
                  opacity: servicesOpacity,
                  flex: 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["הכל", "אילוף", "טיפוח", "פנסיון"].map((cat, i) => (
                      <span
                        key={cat}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 6,
                          background: i === 0 ? ORANGE : "#f1f5f9",
                          color: i === 0 ? "white" : "#64748b",
                          cursor: "pointer",
                        }}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>מוצרים ושירותים</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {SERVICES.map((svc, i) => {
                    const sOpacity = interpolate(frame, [svc.delay + i * 8, svc.delay + i * 8 + 12], [0, 1], { extrapolateRight: "clamp" });
                    const isAdded = i === 1 && item1Added > 0.5;
                    return (
                      <div
                        key={svc.name}
                        style={{
                          opacity: sOpacity,
                          background: isAdded ? "#fff7ed" : "#f8fafc",
                          border: `1.5px solid ${isAdded ? ORANGE : "#e2e8f0"}`,
                          borderRadius: 10,
                          padding: "12px 14px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: isAdded ? ORANGE : "#0f172a" }}>{svc.price}</span>
                          <span style={{ fontSize: 11, color: "#94a3b8", background: "#e2e8f0", borderRadius: 4, padding: "1px 6px" }}>{svc.category}</span>
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: isAdded ? ORANGE : "#374151", marginBottom: 10 }}>{svc.name}</div>
                        <div
                          style={{
                            background: isAdded ? ORANGE : "white",
                            border: `1px solid ${isAdded ? ORANGE : "#e2e8f0"}`,
                            borderRadius: 6,
                            padding: "6px",
                            textAlign: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            color: isAdded ? "white" : "#374151",
                            cursor: "pointer",
                          }}
                        >
                          {isAdded ? "✓ נוסף" : "+ הוסף"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Left panel: summary */}
            <div
              style={{
                width: 220,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  padding: "16px 18px",
                  flex: 1,
                  opacity: Math.max(customerOpacity, summaryOpacity),
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>סיכום הזמנה</span>
                </div>

                {item1Added > 0.3 ? (
                  <>
                    <div style={{ opacity: item1Added }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 0",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₪400</span>
                        <span style={{ fontSize: 13, color: "#374151" }}>אילוף בבית הלקוח</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "10px 0",
                          marginTop: 4,
                        }}
                      >
                        <span style={{ fontSize: 15, fontWeight: 800, color: ORANGE }}>₪400</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>סה"כ</span>
                      </div>
                    </div>

                    <div
                      style={{
                        opacity: sendHighlight,
                        transform: `scale(${sendScale})`,
                        background: "#16a34a",
                        color: "white",
                        borderRadius: 8,
                        padding: "12px",
                        fontSize: 13,
                        fontWeight: 700,
                        textAlign: "center",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        boxShadow: `0 4px 14px rgba(22,163,74,${sendHighlight * 0.35})`,
                        marginTop: 12,
                      }}
                    >
                      שלח בוואטסאפ
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: 1,
                      paddingTop: 24,
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}>לא נבחרו מוצרים</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success toast */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: "50%",
          transform: `translateX(-50%) translateY(${toastY}px)`,
          opacity: toastOpacity,
          background: "#0f172a",
          color: "white",
          borderRadius: 12,
          padding: "12px 20px",
          fontSize: 13,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          whiteSpace: "nowrap",
        }}
      >
        בקשת תשלום נשלחה לספיר מזרחי בוואטסאפ
      </div>
    </AbsoluteFill>
  );
};
