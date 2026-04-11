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

const BULLETS = [
  { text: "פרטי העסק" },
  { text: "הזמנות וזמינות" },
  { text: "צוות ותשלומים" },
  { text: "אינטגרציות" },
];

export const SettingsIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);

  const logoScale = spring({ frame: frame - 5, fps, config: { damping: 200 } });

  const badgeOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });

  const titleProgress = spring({ frame: frame - 30, fps, config: { damping: 200 } });
  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const titleOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" });

  const subtitleOpacity = interpolate(frame, [48, 62], [0, 1], { extrapolateRight: "clamp" });
  const subtitleY = interpolate(
    spring({ frame: frame - 48, fps, config: { damping: 200 } }),
    [0, 1],
    [20, 0]
  );

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: "linear-gradient(145deg, #0f172a 0%, #1e293b 60%, #0c1422 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "25%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 700,
          height: 500,
          background: `radial-gradient(ellipse, rgba(234,88,12,${0.1 + pulse * 0.05}) 0%, transparent 65%)`,
          pointerEvents: "none",
        }}
      />

      {/* Decorative dots */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${10 + i * 11}%`,
            left: `${3 + i * 12}%`,
            width: i % 2 === 0 ? 4 : 2,
            height: i % 2 === 0 ? 4 : 2,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.15)",
          }}
        />
      ))}

      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Img src={staticFile("petra-icon.png")} style={{ width: 44, height: 44, objectFit: "contain" }} />
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>
          PETRA
        </span>
      </div>

      {/* Title */}
      <h1
        style={{
          color: "white",
          fontSize: 60,
          fontWeight: 800,
          margin: 0,
          marginBottom: 18,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          lineHeight: 1.15,
          textShadow: "0 2px 20px rgba(234,88,12,0.3)",
        }}
      >
        הגדרות פטרה
      </h1>

      {/* Subtitle */}
      <p
        style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 20,
          margin: 0,
          marginBottom: 36,
          textAlign: "center",
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
          maxWidth: 560,
          lineHeight: 1.6,
        }}
      >
        כל ההגדרות — במקום אחד, בשליטה מלאה
      </p>

      {/* Bullets */}
      <div style={{ display: "flex", gap: 16, opacity: subtitleOpacity, transform: `translateY(${subtitleY}px)` }}>
        {BULLETS.map((b, i) => {
          const bOpacity = interpolate(frame, [68 + i * 10, 82 + i * 10], [0, 1], { extrapolateRight: "clamp" });
          return (
            <div
              key={b.text}
              style={{
                opacity: bOpacity,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: "10px 16px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{b.text}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
