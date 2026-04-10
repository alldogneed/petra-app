// src/scenes/BookingIntroScene.tsx
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

export const BookingIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const logoScale = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const badgeOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });

  const titleProgress = spring({ frame: frame - 30, fps, config: { damping: 200 } });
  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const titleOpacity = interpolate(frame, [30, 45], [0, 1], { extrapolateRight: "clamp" });

  const subtitleProgress = spring({ frame: frame - 48, fps, config: { damping: 200 } });
  const subtitleY = interpolate(subtitleProgress, [0, 1], [20, 0]);
  const subtitleOpacity = interpolate(frame, [48, 62], [0, 1], { extrapolateRight: "clamp" });

  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);

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
      <div style={{
        position: "absolute",
        top: "25%", left: "50%",
        transform: "translateX(-50%)",
        width: 700, height: 500,
        background: `radial-gradient(ellipse, rgba(234,88,12,${0.1 + pulse * 0.05}) 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      {/* Decorative dots */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${10 + i * 11}%`, left: `${3 + i * 12}%`,
          width: i % 2 === 0 ? 4 : 2, height: i % 2 === 0 ? 4 : 2,
          borderRadius: "50%", background: "rgba(255,255,255,0.15)",
        }} />
      ))}

      {/* Logo */}
      <div style={{
        transform: `scale(${logoScale})`,
        marginBottom: 24,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 44, height: 44, objectFit: "contain" }} />
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>
          PETRA
        </span>
      </div>

      {/* Badge */}
      <div style={{
        opacity: badgeOpacity,
        background: "rgba(234,88,12,0.15)",
        border: "1px solid rgba(234,88,12,0.5)",
        borderRadius: 99, padding: "5px 16px",
        marginBottom: 20,
        color: "#fb923c", fontSize: 13, fontWeight: 600,
      }}>
        מדריך מהיר
      </div>

      {/* Title */}
      <h1 style={{
        color: "white", fontSize: 60, fontWeight: 800,
        margin: 0, marginBottom: 18,
        textAlign: "center",
        opacity: titleOpacity,
        transform: `translateY(${titleY}px)`,
        lineHeight: 1.15,
        textShadow: "0 2px 20px rgba(234,88,12,0.3)",
      }}>
        הזמנות אונליין
      </h1>

      {/* Subtitle */}
      <p style={{
        color: "#94a3b8", fontSize: 20,
        margin: 0, textAlign: "center",
        opacity: subtitleOpacity,
        transform: `translateY(${subtitleY}px)`,
        maxWidth: 560, lineHeight: 1.6,
      }}>
        לקוחות קובעים לבד — עשרים וארבע שבע, בלי לחכות לתשובה
      </p>
    </AbsoluteFill>
  );
};
