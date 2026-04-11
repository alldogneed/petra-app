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

const FEATURES = [
  { icon: "📅", text: "לוח שנה חכם" },
  { icon: "💬", text: "WhatsApp אוטומטי" },
  { icon: "📄", text: "חוזים דיגיטליים" },
  { icon: "₪", text: "ניהול תשלומים" },
  { icon: "🐾", text: "פרופילי לקוחות" },
  { icon: "📊", text: "דוחות ואנליטיקס" },
];

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.5, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  // Background pulse
  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  // Logo
  const logoScale = spring({ frame: frame - 5, fps, config: { damping: 200 } });

  // Title
  const titleProgress = spring({ frame: frame - 15, fps, config: { damping: 200 } });
  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const titleOpacity = interpolate(frame, [15, 28], [0, 1], { extrapolateRight: "clamp" });

  // Features grid
  const featuresOpacity = interpolate(frame, [35, 55], [0, 1], {
    extrapolateRight: "clamp",
  });

  // CTA button
  const ctaProgress = spring({ frame: frame - 65, fps, config: { damping: 200 } });
  const ctaScale = interpolate(ctaProgress, [0, 1], [0.5, 1]);
  const ctaOpacity = interpolate(frame, [65, 80], [0, 1], { extrapolateRight: "clamp" });

  // URL
  const urlOpacity = interpolate(frame, [80, 95], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: `radial-gradient(ellipse at 50% 50%, rgba(234,88,12,${0.08 + pulse * 0.04}) 0%, transparent 60%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        padding: "0 80px",
      }}
    >
      {/* Stars decoration */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${15 + i * 13}%`,
            left: `${5 + i * 15}%`,
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.3)",
          }}
        />
      ))}

      {/* Logo */}
      <div
        style={{
          marginBottom: 28,
          transform: `scale(${logoScale})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Img
          src={staticFile("petra-logo.png")}
          style={{
            width: 200,
            height: "auto",
            objectFit: "contain",
            filter: "brightness(0) invert(1)",
          }}
        />
      </div>

      {/* Main title */}
      <h1
        style={{
          color: "white",
          fontSize: 48,
          fontWeight: 800,
          margin: 0,
          marginBottom: 12,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          lineHeight: 1.2,
        }}
      >
        מוכנים לנהל את העסק?
      </h1>

      <p
        style={{
          color: "#94a3b8",
          fontSize: 18,
          margin: 0,
          marginBottom: 36,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        כל הכלים שצריכים לעסקי טיפול בחיות מחמד
      </p>

      {/* Features grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 12,
          marginBottom: 40,
          width: "100%",
          maxWidth: 900,
          opacity: featuresOpacity,
        }}
      >
        {FEATURES.map((f, i) => {
          const featureProgress = spring({
            frame: frame - 35 - i * 6,
            fps,
            config: { damping: 200 },
          });
          const featureScale = interpolate(featureProgress, [0, 1], [0.8, 1]);
          const featureOpacity = interpolate(
            frame,
            [35 + i * 6, 48 + i * 6],
            [0, 1],
            { extrapolateRight: "clamp" }
          );

          return (
            <div
              key={f.text}
              style={{
                background: "rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "14px 10px",
                textAlign: "center",
                border: "1px solid rgba(255,255,255,0.1)",
                transform: `scale(${featureScale})`,
                opacity: featureOpacity,
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{f.text}</div>
            </div>
          );
        })}
      </div>

      {/* CTA Button */}
      <div
        style={{
          background: "linear-gradient(135deg, #ea580c, #c2410c)",
          borderRadius: 16,
          padding: "18px 48px",
          opacity: ctaOpacity,
          transform: `scale(${ctaScale})`,
          boxShadow: "0 8px 32px rgba(234,88,12,0.4)",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 20,
            fontWeight: 800,
          }}
        >
          הירשמו בחינם ←
        </span>
      </div>

      {/* URL */}
      <div
        style={{
          marginTop: 20,
          opacity: urlOpacity,
        }}
      >
        <span
          style={{
            color: "#64748b",
            fontSize: 16,
            fontWeight: 500,
          }}
        >
          petra-app.com
        </span>
      </div>
    </AbsoluteFill>
  );
};
