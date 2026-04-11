import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { SettingsTabsBar } from "./SettingsTabsBar";
import { CursorOverlay, CursorWaypoint } from "./CursorOverlay";
import { HighlightBox } from "./HighlightBox";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const ORANGE = "#ea580c";

const CONTRACTS = [
  { name: "חוזה שירות סטנדרטי", updated: "15/03/2026", signed: 24 },
  { name: "הסכם פנסיון", updated: "10/02/2026", signed: 11 },
  { name: "הסכם אילוף", updated: "01/01/2026", signed: 8 },
];

// Full-width contracts section. Grid cols RTL order (right→left): שם(2fr) | עודכן(1fr) | חוזים(1fr) | buttons(0.8fr)
// "+ תבנית חדשה" button: first child in RTL flex header → RIGHT side x≈985
// First contract row: שם center x≈790, שלח button (col4) x≈70
const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,   x: 400, y: 360 },
  { frame: 22,  x: 985, y: 30 },                       // + תבנית חדשה button (right side RTL header)
  { frame: 55,  x: 985, y: 30, action: "click" },
  { frame: 95,  x: 790, y: 252 },                      // first contract name
  { frame: 132, x: 790, y: 252 },                      // hover
  { frame: 162, x: 75,  y: 252 },                      // שלח button (leftmost col)
  { frame: 195, x: 75,  y: 252, action: "click" },
  { frame: 242, x: 790, y: 298 },                      // second contract
  { frame: 278, x: 75,  y: 298 },                      // שלח second
  { frame: 310, x: 75,  y: 298, action: "click" },
  { frame: 352, x: 350, y: 450 },                      // info card
  { frame: 388, x: 350, y: 450 },
  { frame: 440, x: 535, y: 360 },
];

export const SettingsPaymentsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const zoomScale = interpolate(frame, [0, durationInFrames], [1.0, 1.05], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", overflow: "hidden", opacity }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoomScale})`,
          transformOrigin: "535px 300px",
        }}
      >
        {/* Vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse 75% 70% at 52% 45%, transparent 45%, rgba(15,23,42,0.09) 100%)",
            pointerEvents: "none",
            zIndex: 98,
          }}
        />

        <PetraSidebar activeLabel="הגדרות" />

        <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>

          <div
            style={{
              background: "white",
              borderBottom: "1px solid #e2e8f0",
              padding: "0 28px",
              height: 58,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: headerOpacity,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <div
                style={{
                  background: ORANGE,
                  color: "white",
                  borderRadius: 8,
                  padding: "7px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                + תבנית חדשה
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>הגדרות</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>ניהול העסק שלך</span>
            </div>
          </div>

          <SettingsTabsBar activeTab="תשלומים" opacity={headerOpacity} />

          <div style={{ flex: 1, padding: "20px 28px", overflowY: "hidden" }}>

            {/* Contracts section */}
            <div
              style={{
                background: "white",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                padding: "22px 28px",
                opacity: interpolate(frame, [15, 28], [0, 1], { extrapolateRight: "clamp" }),
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div
                  style={{
                    background: "rgba(234,88,12,0.08)",
                    border: "1px solid rgba(234,88,12,0.2)",
                    borderRadius: 99,
                    padding: "3px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    color: ORANGE,
                  }}
                >
                  חתימה דיגיטלית
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>תבניות חוזים</div>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20, textAlign: "right", lineHeight: 1.5 }}>
                צרו תבניות חוזה, שלחו ללקוח — והוא חותם מהטלפון בשניות.
              </div>

              {/* Table header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr 0.8fr",
                  gap: 8,
                  padding: "6px 14px",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  letterSpacing: "0.04em",
                  marginBottom: 6,
                  opacity: interpolate(frame, [25, 38], [0, 1], { extrapolateRight: "clamp" }),
                }}
              >
                <span>שם התבנית</span>
                <span>עודכן</span>
                <span>חוזים שנחתמו</span>
                <span></span>
              </div>

              {CONTRACTS.map((contract, i) => {
                const cOpacity = interpolate(frame, [32 + i * 12, 46 + i * 12], [0, 1], { extrapolateRight: "clamp" });
                const cX = interpolate(
                  spring({ frame: frame - 32 - i * 12, fps, config: { damping: 200 } }),
                  [0, 1],
                  [12, 0]
                );
                return (
                  <div
                    key={contract.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 0.8fr",
                      gap: 8,
                      padding: "12px 14px",
                      borderRadius: 8,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      marginBottom: 8,
                      alignItems: "center",
                      opacity: cOpacity,
                      transform: `translateX(${cX}px)`,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{contract.name}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>{contract.updated}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#22c55e" }}>{contract.signed} חוזים</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <div
                        style={{
                          background: "white",
                          border: "1px solid #e2e8f0",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 11,
                          color: "#475569",
                          fontWeight: 600,
                        }}
                      >
                        עריכה
                      </div>
                      <div
                        style={{
                          background: ORANGE,
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 11,
                          color: "white",
                          fontWeight: 700,
                        }}
                      >
                        שלח
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Info card */}
            <div
              style={{
                background: "rgba(59,130,246,0.04)",
                borderRadius: 10,
                border: "1px solid rgba(59,130,246,0.15)",
                padding: "14px 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                opacity: interpolate(frame, [75, 90], [0, 1], { extrapolateRight: "clamp" }),
                maxWidth: 560,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
                הלקוח מקבל קישור לחתימה ב-SMS / WhatsApp ולא צריך להתקין כלום.
              </span>
            </div>
          </div>
        </div>

        {/* Highlights */}
        {/* First contract row — measured at y=246, h≈45 */}
        <HighlightBox x={28} y={246} width={1014} height={45} startFrame={88} endFrame={210} borderRadius={8} />
        {/* Info card — measured via blue dot at rendered y=499, pre-zoom y≈468, h≈48 */}
        <HighlightBox x={28} y={468} width={560} height={48} startFrame={330} endFrame={430} borderRadius={10} />

        <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
      </div>
    </AbsoluteFill>
  );
};
