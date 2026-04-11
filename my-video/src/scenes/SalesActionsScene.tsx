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

const ACTIONS = [
  { label: "התקשרתי", icon: "📞", color: "#16a34a", bg: "#f0fdf4", border: "#86efac", desc: 'מעביר ל"נוצר קשר ראשוני"', delay: 40 },
  { label: "לא ענה", icon: "📵", color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d", desc: 'מעביר ל"ללא מענה"', delay: 56 },
  { label: "שלח וואטסאפ", icon: "💬", color: "#22c55e", bg: "#f0fdf4", border: "#86efac", desc: "פותח שיחה ישירה", delay: 72 },
  { label: "קבע פולואפ", icon: "📅", color: "#3b82f6", bg: "#eff6ff", border: "#93c5fd", desc: "מתזמן תאריך מעקב", delay: 88 },
  { label: "טופל", icon: "✅", color: "#8b5cf6", bg: "#f5f3ff", border: "#c4b5fd", desc: "סגירת הליד כטופל", delay: 104 },
];

export const SalesActionsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const cardProgress = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const cardScale = interpolate(cardProgress, [0, 1], [0.88, 1]);
  const cardOpacity = interpolate(frame, [8, 20], [0, 1], { extrapolateRight: "clamp" });

  // Highlight "התקשרתי" at frame 120–165
  const showCallHighlight = frame >= 120 && frame <= 170;
  const callPulse = showCallHighlight
    ? Math.max(0, Math.sin(((frame - 120) / 12) * Math.PI))
    : 0;

  // Highlight "שלח וואטסאפ" at frame 175–215
  const showWaHighlight = frame >= 175 && frame <= 220;
  const waPulse = showWaHighlight
    ? Math.max(0, Math.sin(((frame - 175) / 12) * Math.PI))
    : 0;

  // Stage transfer result at frame 172
  const transferOpacity = interpolate(frame, [172, 185], [0, 1], { extrapolateRight: "clamp" });
  const transferScale = spring({ frame: frame - 172, fps, config: { damping: 200 } });

  // WhatsApp message preview at frame 222
  const waOpacity = interpolate(frame, [222, 235], [0, 1], { extrapolateRight: "clamp" });
  const waScale = spring({ frame: frame - 222, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} />

      {/* Content */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          height: 52, padding: "0 24px",
          display: "flex", alignItems: "center", gap: 8,
          opacity: interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" }),
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>לידים</span>
          <span style={{ color: "#cbd5e1" }}>/</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: ORANGE }}>פעולות על ליד</span>
        </div>

        {/* Main */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 48, padding: "0 40px" }}>

          {/* Lead card */}
          <div style={{
            opacity: cardOpacity,
            transform: `scale(${cardScale})`,
            background: "white",
            borderRadius: 10,
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
            border: "1px solid #e2e8f0",
            borderRight: "3px solid #ef4444",
            width: 240,
            direction: "rtl",
          }}>
            <div style={{ padding: "14px 14px 14px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>ענבל כהן</span>
                <span style={{ fontSize: 9, fontWeight: 700, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "2px 7px" }}>אתר</span>
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>🐾 <b>קיירה</b> · גולדן</div>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 8, direction: "ltr", textAlign: "right" }}>054-321-8876</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#94a3b8" }}>📅 9 אפריל</span>
                <span style={{ fontSize: 10, fontWeight: 600, background: "#fff7ed", color: ORANGE, borderRadius: 4, padding: "2px 7px", border: "1px solid #fed7aa" }}>אילוף גורים</span>
              </div>
            </div>

            <div style={{ height: 1, background: "#f1f5f9" }} />

            <div style={{
              padding: "8px 14px",
              fontSize: 10, color: "#94a3b8",
              display: "flex", alignItems: "center", gap: 4,
              opacity: interpolate(frame, [25, 38], [0, 1], { extrapolateRight: "clamp" }),
            }}>
              <span>👆</span> לחצו לפעולות
            </div>
          </div>

          {/* Actions panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 260 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 4,
              opacity: interpolate(frame, [28, 40], [0, 1], { extrapolateRight: "clamp" }),
            }}>
              פעולות זמינות:
            </div>

            {ACTIONS.map((action, i) => {
              const btnProgress = spring({ frame: frame - action.delay, fps, config: { damping: 200 } });
              const btnX = interpolate(btnProgress, [0, 1], [24, 0]);
              const btnOpacity = interpolate(frame, [action.delay, action.delay + 14], [0, 1], { extrapolateRight: "clamp" });

              const isCallHighlighted = i === 0 && showCallHighlight;
              const isWaHighlighted = i === 2 && showWaHighlight;
              const isHighlighted = isCallHighlighted || isWaHighlighted;
              const pulse = isCallHighlighted ? callPulse : isWaHighlighted ? waPulse : 0;
              const glowSize = isHighlighted ? Math.round(pulse * 5) : 0;

              return (
                <div key={action.label} style={{
                  opacity: btnOpacity,
                  transform: `translateX(${btnX}px)`,
                  display: "flex", alignItems: "center", gap: 10,
                  background: isHighlighted ? action.bg : "white",
                  border: `1.5px solid ${isHighlighted ? action.border : "#e2e8f0"}`,
                  borderRadius: 9,
                  padding: "10px 14px",
                  boxShadow: glowSize > 0 ? `0 0 0 ${glowSize}px ${action.border}60` : "none",
                }}>
                  <span style={{ fontSize: 18 }}>{action.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isHighlighted ? action.color : "#0f172a" }}>{action.label}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{action.desc}</div>
                  </div>
                  {isHighlighted && (
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: action.color, opacity: 0.7 + pulse * 0.3 }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Right side: transfer result OR whatsapp preview */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>

            {/* Transfer result */}
            <div style={{
              opacity: transferOpacity,
              transform: `scale(${transferScale})`,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
            }}>
              <div style={{ fontSize: 28, color: "#94a3b8" }}>→</div>
              <div style={{
                background: "#f0fdf4",
                border: "2px solid #86efac",
                borderRadius: 12,
                padding: "14px 20px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>עבר לשלב</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, justifyContent: "center" }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#3b82f6" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1d4ed8" }}>נוצר קשר ראשוני</span>
                </div>
              </div>
            </div>

            {/* WhatsApp message preview */}
            <div style={{
              opacity: waOpacity,
              transform: `scale(${waScale})`,
              background: "#f0fdf4",
              border: "2px solid #86efac",
              borderRadius: 12,
              padding: "14px 18px",
              maxWidth: 240,
              direction: "rtl",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>💬</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#15803d" }}>הודעת וואטסאפ נשלחת</span>
              </div>
              <div style={{
                background: "white",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 11,
                color: "#374151",
                lineHeight: 1.6,
                border: "1px solid #dcfce7",
              }}>
                היי ענבל, זה מאיה מאילוף כלבים 🐾<br />
                ראיתי שנרשמת בנושא אילוף גורים עבור קיירה.<br />
                אשמח לשוחח ולתאם שיעור היכרות 😊
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
