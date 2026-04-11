import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

const ACTIONS = [
  { label: "שלח וואטסאפ", color: "#22c55e", highlight: [18, 55], desc: "פותח שיחה ישירה עם הלקוח" },
  { label: "קבע תור", color: "#3b82f6", highlight: [60, 100], desc: "עובר ישירות ליומן עם הלקוח מולא" },
  { label: "הזמנה חדשה", color: "#8b5cf6", highlight: [105, 145], desc: "פותח טופס הזמנה עם הלקוח מולא" },
  { label: "שלח חיוב", color: "#f59e0b", highlight: [150, 190], desc: "שולח דרישת תשלום בוואטסאפ" },
];

export const CustomersActionsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const cardOpacity = interpolate(frame, [10, 24], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="לקוחות" />

      <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 8, opacity: headerOpacity }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>לקוחות</span>
          <span style={{ color: "#94a3b8" }}>›</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>דנה לוי</span>
        </div>

        <div style={{ flex: 1, display: "flex", gap: 20, padding: "16px 28px" }}>
          {/* Left: customer profile (static) */}
          <div
            style={{
              width: 200,
              background: "white",
              borderRadius: 14,
              padding: "18px",
              border: "1px solid #e2e8f0",
              opacity: cardOpacity,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              alignSelf: "flex-start",
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #ea580c, #c2410c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: "white", fontWeight: 800 }}>ד</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>דנה לוי</div>
              <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>VIP</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>054-321-8876</div>
            </div>
            <div style={{ width: "100%", height: 1, background: "#f1f5f9" }} />
            <div style={{ fontSize: 12, color: "#64748b", textAlign: "center" }}>חיות: מיקי</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>₪2,840</div>
          </div>

          {/* Right: action buttons */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, justifyContent: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#64748b", marginBottom: 4, opacity: cardOpacity }}>פעולות מהירות</div>
            {ACTIONS.map((action) => {
              const isActive = frame >= action.highlight[0] && frame <= action.highlight[1];
              const activeProg = interpolate(frame, action.highlight, [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const btnOpacity = interpolate(frame, [action.highlight[0] - 10, action.highlight[0]], [0.5, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

              return (
                <div
                  key={action.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    opacity: btnOpacity,
                  }}
                >
                  {/* Button */}
                  <div
                    style={{
                      background: isActive ? action.color : "white",
                      border: `2px solid ${isActive ? action.color : "#e2e8f0"}`,
                      borderRadius: 12,
                      padding: "14px 24px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: "pointer",
                      boxShadow: isActive ? `0 8px 24px ${action.color}40` : "none",
                      transform: `scale(${isActive ? 1 + activeProg * 0.03 : 1})`,
                      transition: "none",
                      minWidth: 180,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: isActive ? "white" : "#0f172a",
                      }}
                    >
                      {action.label}
                    </span>
                  </div>

                  {/* Description */}
                  <div
                    style={{
                      opacity: isActive ? 1 : 0,
                      background: `${action.color}10`,
                      border: `1px solid ${action.color}30`,
                      borderRadius: 8,
                      padding: "8px 14px",
                      fontSize: 13,
                      color: action.color,
                      fontWeight: 600,
                    }}
                  >
                    ← {action.desc}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
