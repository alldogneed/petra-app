import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

const PANELS = [
  {
    icon: "🏠",
    trigger: "הזמנת פנסיון",
    triggerColor: "#22c55e",
    result: "חדר נפתח בפנסיון",
    resultColor: "#16a34a",
    delay: 20,
  },
  {
    icon: "🐾",
    trigger: "הזמנת אילוף",
    triggerColor: "#6366f1",
    result: "תהליך אילוף נפתח",
    resultColor: "#4f46e5",
    delay: 90,
  },
  {
    icon: "📲",
    trigger: "הזמנה עם תאריך",
    triggerColor: "#0ea5e9",
    result: "תזכורת WhatsApp",
    resultColor: "#0284c7",
    badge: "PRO+",
    delay: 160,
  },
];

export const OrdersAutoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const titleOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });
  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  return (
    <AbsoluteFill style={{
      opacity,
      background: `radial-gradient(ellipse at 50% 40%, rgba(234,88,12,${0.06 + pulse * 0.03}) 0%, transparent 60%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
      fontFamily: FONT,
      direction: "rtl",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 60px",
    }}>
      {/* Title */}
      <div style={{
        opacity: titleOpacity,
        fontSize: 26, fontWeight: 800, color: "white",
        marginBottom: 48, textAlign: "center",
      }}>
        מה נוצר אוטומטית ברגע שיוצרים הזמנה
      </div>

      {/* 3 panels */}
      <div style={{ display: "flex", gap: 24, width: "100%", justifyContent: "center" }}>
        {PANELS.map((panel) => {
          const panelProgress = spring({ frame: frame - panel.delay, fps, config: { damping: 200 } });
          const panelOpacity = interpolate(frame, [panel.delay, panel.delay + 14], [0, 1], { extrapolateRight: "clamp" });
          const panelY = interpolate(panelProgress, [0, 1], [30, 0]);
          const arrowOpacity = interpolate(frame, [panel.delay + 25, panel.delay + 40], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div key={panel.trigger} style={{
              flex: 1,
              maxWidth: 280,
              opacity: panelOpacity,
              transform: `translateY(${panelY}px)`,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              backdropFilter: "blur(4px)",
            }}>
              {/* Icon */}
              <span style={{ fontSize: 36 }}>{panel.icon}</span>

              {/* Trigger */}
              <div style={{
                background: `${panel.triggerColor}22`,
                border: `1.5px solid ${panel.triggerColor}55`,
                borderRadius: 10, padding: "8px 16px",
                fontSize: 13, fontWeight: 700,
                color: panel.triggerColor,
                textAlign: "center",
              }}>
                {panel.trigger}
              </div>

              {/* Arrow */}
              <div style={{
                opacity: arrowOpacity,
                fontSize: 22, color: "rgba(255,255,255,0.4)",
              }}>
                ↓
              </div>

              {/* Result */}
              <div style={{
                opacity: arrowOpacity,
                textAlign: "center",
              }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: "white",
                  marginBottom: 6,
                }}>
                  {panel.result}
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                  אוטומטית, ללא פעולה נוספת
                </div>
                {panel.badge && (
                  <div style={{
                    display: "inline-block",
                    marginTop: 8,
                    background: "rgba(234,88,12,0.25)",
                    border: "1px solid rgba(234,88,12,0.5)",
                    borderRadius: 99, padding: "2px 10px",
                    fontSize: 10, fontWeight: 700, color: "#fb923c",
                  }}>
                    {panel.badge}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
