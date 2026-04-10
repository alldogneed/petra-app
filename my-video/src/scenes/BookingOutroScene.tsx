// src/scenes/BookingOutroScene.tsx
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

export const BookingOutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  const logoP = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const logoScale = interpolate(logoP, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const line1P = spring({ frame: frame - 22, fps, config: { damping: 200 } });
  const line1Y = interpolate(line1P, [0, 1], [30, 0]);
  const line1Opacity = interpolate(frame, [22, 38], [0, 1], { extrapolateRight: "clamp" });

  const line2P = spring({ frame: frame - 42, fps, config: { damping: 200 } });
  const line2Y = interpolate(line2P, [0, 1], [30, 0]);
  const line2Opacity = interpolate(frame, [42, 58], [0, 1], { extrapolateRight: "clamp" });

  const ctaP = spring({ frame: frame - 70, fps, config: { damping: 200 } });
  const ctaScale = interpolate(ctaP, [0, 1], [0.6, 1]);
  const ctaOpacity = interpolate(frame, [70, 86], [0, 1], { extrapolateRight: "clamp" });

  const urlOpacity = interpolate(frame, [90, 106], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      opacity,
      background: `radial-gradient(ellipse at 50% 40%, rgba(234,88,12,${0.08 + pulse * 0.04}) 0%, transparent 55%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: FONT, direction: "rtl",
      padding: "0 80px",
    }}>
      {/* Stars */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${12 + i * 10}%`, left: `${4 + i * 13}%`,
          width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
          borderRadius: "50%", background: "rgba(255,255,255,0.2)",
        }} />
      ))}

      {/* Petra logo */}
      <div style={{ transform: `scale(${logoScale})`, opacity: logoOpacity, marginBottom: 28 }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 80, height: 80, objectFit: "contain" }} />
      </div>

      {/* Line 1 — white */}
      <div style={{
        color: "white", fontSize: 48, fontWeight: 800, textAlign: "center",
        opacity: line1Opacity, transform: `translateY(${line1Y}px)`,
        marginBottom: 8,
      }}>
        פחות תיאום
      </div>

      {/* Line 2 — orange */}
      <div style={{
        color: ORANGE, fontSize: 48, fontWeight: 800, textAlign: "center",
        opacity: line2Opacity, transform: `translateY(${line2Y}px)`,
        marginBottom: 40,
        textShadow: "0 0 30px rgba(234,88,12,0.5)",
      }}>
        יותר זמן לעסק
      </div>

      {/* CTA */}
      <div style={{
        background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
        borderRadius: 16, padding: "16px 48px",
        opacity: ctaOpacity, transform: `scale(${ctaScale})`,
        boxShadow: "0 8px 32px rgba(234,88,12,0.45)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ color: "white", fontSize: 18, fontWeight: 800 }}>התחילו בחינם</span>
        <span style={{ color: "white", fontSize: 20 }}>←</span>
      </div>

      {/* URL */}
      <div style={{ marginTop: 18, opacity: urlOpacity }}>
        <span style={{ color: "#475569", fontSize: 14, fontWeight: 500 }}>petra-app.com</span>
      </div>
    </AbsoluteFill>
  );
};
