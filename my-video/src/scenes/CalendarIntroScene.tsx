// src/scenes/CalendarIntroScene.tsx
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

export const CalendarIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  const logoP = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const logoScale = interpolate(logoP, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const badgeOpacity = interpolate(frame, [25, 38], [0, 1], { extrapolateRight: "clamp" });

  const titleP = spring({ frame: frame - 35, fps, config: { damping: 200 } });
  const titleY = interpolate(titleP, [0, 1], [30, 0]);
  const titleOpacity = interpolate(frame, [35, 50], [0, 1], { extrapolateRight: "clamp" });

  const subtitleP = spring({ frame: frame - 50, fps, config: { damping: 200 } });
  const subtitleY = interpolate(subtitleP, [0, 1], [20, 0]);
  const subtitleOpacity = interpolate(frame, [50, 65], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      opacity,
      background: `radial-gradient(ellipse at 50% 40%, rgba(234,88,12,${0.08 + pulse * 0.04}) 0%, transparent 55%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: FONT, direction: "rtl",
      padding: "0 80px",
    }}>
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${12 + i * 10}%`, left: `${4 + i * 13}%`,
          width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
          borderRadius: "50%", background: "rgba(255,255,255,0.2)",
        }} />
      ))}

      <div style={{
        position: "absolute",
        width: 400, height: 400, borderRadius: "50%",
        background: `radial-gradient(circle, rgba(234,88,12,${0.06 + pulse * 0.03}) 0%, transparent 70%)`,
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
      }} />

      <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 56, height: 56, objectFit: "contain" }} />
        <span style={{ color: "white", fontSize: 28, fontWeight: 800, letterSpacing: 3 }}>PETRA</span>
      </div>

      <div style={{
        opacity: badgeOpacity,
        background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
        borderRadius: 20, padding: "6px 18px", marginBottom: 20,
      }}>
        <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>מדריך מהיר</span>
      </div>

      <h1 style={{
        color: "white", fontSize: 60, fontWeight: 800,
        margin: 0, marginBottom: 14, textAlign: "center",
        opacity: titleOpacity, transform: `translateY(${titleY}px)`,
        lineHeight: 1.2,
      }}>
        יומן פטרה
      </h1>

      <p style={{
        color: "#94a3b8", fontSize: 20, fontWeight: 400,
        margin: 0, textAlign: "center",
        opacity: subtitleOpacity, transform: `translateY(${subtitleY}px)`,
        maxWidth: 560, lineHeight: 1.6,
      }}>
        כל התורים, החזרות והזמינות — במקום אחד
      </p>
    </AbsoluteFill>
  );
};
