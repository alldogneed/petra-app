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

const BENEFITS = [
  { text: "מחירון אחד לכל השירותים" },
  { text: "הזמנות עם מעקב סטטוס" },
  { text: "גבייה בלחיצה בוואטסאפ" },
  { text: "מעקב תשלומים בזמן אמת" },
];

export const FinancesOutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  const logoProgress = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const logoScale = interpolate(logoProgress, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const titleProgress = spring({ frame: frame - 22, fps, config: { damping: 200 } });
  const titleY = interpolate(titleProgress, [0, 1], [30, 0]);
  const titleOpacity = interpolate(frame, [22, 38], [0, 1], { extrapolateRight: "clamp" });

  const benefitsDelay = 50;

  const ctaProgress = spring({ frame: frame - 90, fps, config: { damping: 200 } });
  const ctaScale = interpolate(ctaProgress, [0, 1], [0.6, 1]);
  const ctaOpacity = interpolate(frame, [90, 106], [0, 1], { extrapolateRight: "clamp" });

  const urlOpacity = interpolate(frame, [110, 126], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: `radial-gradient(ellipse at 50% 40%, rgba(234,88,12,${0.08 + pulse * 0.04}) 0%, transparent 55%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        padding: "0 80px",
      }}
    >
      {/* Stars */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${12 + i * 10}%`,
            left: `${4 + i * 13}%`,
            width: i % 3 === 0 ? 3 : 2,
            height: i % 3 === 0 ? 3 : 2,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.2)",
          }}
        />
      ))}

      {/* Logo */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          opacity: logoOpacity,
          marginBottom: 32,
        }}
      >
        <Img src={staticFile("petra-icon.png")} style={{ width: 88, height: 88, objectFit: "contain" }} />
      </div>

      {/* Title */}
      <h1
        style={{
          color: "white",
          fontSize: 44,
          fontWeight: 800,
          margin: 0,
          marginBottom: 10,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          lineHeight: 1.2,
        }}
      >
        מערכת הפיננסים של פטרה
      </h1>
      <p
        style={{
          color: "white",
          fontSize: 20,
          fontWeight: 700,
          margin: 0,
          marginBottom: 40,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        מחירון אחד שמניע את כל העסק
      </p>

      {/* Benefits */}
      <div style={{ display: "flex", gap: 14, marginBottom: 40, justifyContent: "center" }}>
        {BENEFITS.map((b, i) => {
          const bOpacity = interpolate(
            frame,
            [benefitsDelay + i * 10, benefitsDelay + i * 10 + 15],
            [0, 1],
            { extrapolateRight: "clamp" }
          );
          const bScale = interpolate(
            spring({ frame: frame - benefitsDelay - i * 10, fps, config: { damping: 200 } }),
            [0, 1],
            [0.8, 1]
          );
          return (
            <div
              key={b.text}
              style={{
                opacity: bOpacity,
                transform: `scale(${bScale})`,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{b.text}</span>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div
        style={{
          background: "linear-gradient(135deg, #ea580c, #c2410c)",
          borderRadius: 16,
          padding: "18px 52px",
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
          boxShadow: "0 8px 32px rgba(234,88,12,0.45)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
          direction: "rtl",
        }}
      >
        <span style={{ color: "white", fontSize: 19, fontWeight: 800 }}>
          הגדירו את המחירון עכשיו ותראו את ההבדל
        </span>
        <span style={{ color: "white", fontSize: 20 }}>←</span>
      </div>

      {/* URL */}
      <div style={{ marginTop: 20, opacity: urlOpacity }}>
        <span style={{ color: "#475569", fontSize: 15, fontWeight: 500 }}>petra-app.com</span>
      </div>
    </AbsoluteFill>
  );
};
