import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";

const SOURCES = [
  { icon: "🌐", label: "מהאתר", color: "#3b82f6", delay: 20 },
  { icon: "🔍", label: "מגוגל", color: "#16a34a", delay: 45 },
  { icon: "📱", label: "מוואטסאפ", color: "#22c55e", delay: 70 },
  { icon: "✏️", label: "ידנית", color: "#8b5cf6", delay: 95 },
];

export const SalesProblemScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.4, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const headerY = interpolate(
    spring({ frame: frame - 5, fps, config: { damping: 200 } }),
    [0, 1],
    [-20, 0]
  );

  // Center card
  const cardProgress = spring({
    frame: frame - 120,
    fps,
    config: { damping: 200 },
  });
  const cardScale = interpolate(cardProgress, [0, 1], [0.85, 1]);
  const cardOpacity = interpolate(frame, [120, 140], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#f8fafc",
        opacity,
        fontFamily: FONT,
        direction: "rtl",
      }}
    >
      {/* Top header bar */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid #e2e8f0",
          padding: "0 48px",
          height: 60,
          display: "flex",
          alignItems: "center",
          opacity: headerOpacity,
          transform: `translateY(${headerY}px)`,
          gap: 12,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: ORANGE,
          }}
        />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
          לידים
        </span>
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 80px",
          gap: 40,
        }}
      >
        {/* Headline */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: "#0f172a",
              marginBottom: 12,
              opacity: interpolate(frame, [10, 28], [0, 1], {
                extrapolateRight: "clamp",
              }),
              transform: `translateY(${interpolate(
                spring({ frame: frame - 10, fps, config: { damping: 200 } }),
                [0, 1],
                [24, 0]
              )}px)`,
            }}
          >
            לידים מכל המקומות — במקום אחד
          </div>
          <div
            style={{
              fontSize: 17,
              color: "#64748b",
              lineHeight: 1.6,
              maxWidth: 560,
              opacity: interpolate(frame, [25, 42], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            אנשים מתעניינים בשירות שלכם כל הזמן. פטרה אוספת את כולם
            <br />
            ומארגנת אותם כך שתוכלו לעקוב ולסגור עסקאות בקלות
          </div>
        </div>

        {/* Source icons */}
        <div
          style={{
            display: "flex",
            gap: 24,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {SOURCES.map((source) => {
            const p = spring({
              frame: frame - source.delay,
              fps,
              config: { damping: 200 },
            });
            const scale = interpolate(p, [0, 1], [0.6, 1]);
            const itemOpacity = interpolate(
              frame,
              [source.delay, source.delay + 15],
              [0, 1],
              { extrapolateRight: "clamp" }
            );
            return (
              <div
                key={source.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  opacity: itemOpacity,
                  transform: `scale(${scale})`,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: `${source.color}15`,
                    border: `2px solid ${source.color}40`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                  }}
                >
                  {source.icon}
                </div>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#475569",
                  }}
                >
                  {source.label}
                </span>
              </div>
            );
          })}

          {/* Arrow to petra — points left (RTL: sources on right → Petra on left) */}
          <div
            style={{
              opacity: interpolate(frame, [100, 118], [0, 1], {
                extrapolateRight: "clamp",
              }),
              color: "#94a3b8",
              fontSize: 28,
            }}
          >
            ←
          </div>

          {/* Petra center */}
          <div
            style={{
              opacity: cardOpacity,
              transform: `scale(${cardScale})`,
              background: "white",
              borderRadius: 16,
              padding: "16px 24px",
              boxShadow: "0 4px 24px rgba(234,88,12,0.15)",
              border: `2px solid ${ORANGE}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Img
              src={staticFile("petra-icon.png")}
              style={{ width: 44, height: 44, objectFit: "contain" }}
            />
            <Img
              src={staticFile("petra-logo.png")}
              style={{
                height: 22,
                width: "auto",
                objectFit: "contain",
                filter: "brightness(0) saturate(100%) invert(35%) sepia(90%) saturate(600%) hue-rotate(10deg)",
              }}
            />
            <div style={{ fontSize: 12, color: "#64748b" }}>מרכז הלידים</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
