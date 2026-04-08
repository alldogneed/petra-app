// src/scenes/teaser/TeaserCTAScene.tsx
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

export const TeaserCTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  const logoScale = spring({ frame: frame - 2, fps, config: { damping: 160 } });

  const mainTextOpacity = interpolate(frame, [8, 20], [0, 1], { extrapolateRight: "clamp" });
  const mainTextY = interpolate(
    spring({ frame: frame - 8, fps, config: { damping: 200 } }),
    [0, 1], [24, 0]
  );

  const subOpacity = interpolate(frame, [20, 32], [0, 1], { extrapolateRight: "clamp" });

  // Pulse effect on main text
  const pulse = interpolate(frame % 30, [0, 15, 30], [1, 1.02, 1]);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(145deg, #ea580c 0%, #c2410c 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        opacity: fadeIn,
        gap: 0,
      }}
    >
      {/* Background shine */}
      <div style={{
        position: "absolute",
        top: "10%", left: "50%",
        transform: "translateX(-50%)",
        width: 600, height: 400,
        background: "radial-gradient(ellipse, rgba(255,255,255,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <div style={{
        transform: `scale(${logoScale})`,
        marginBottom: 20,
      }}>
        <Img
          src={staticFile("petra-icon.png")}
          style={{ width: 64, height: 64, objectFit: "contain" }}
        />
      </div>

      {/* Main CTA */}
      <div style={{
        opacity: mainTextOpacity,
        transform: `translateY(${mainTextY}px) scale(${pulse})`,
        fontSize: 52,
        fontWeight: 900,
        color: "white",
        textAlign: "center",
        textShadow: "0 3px 20px rgba(0,0,0,0.2)",
        marginBottom: 14,
        lineHeight: 1.15,
      }}>
        נסו פטרה חינם
      </div>

      {/* Subtitle */}
      <div style={{
        opacity: subOpacity,
        fontSize: 20,
        color: "rgba(255,255,255,0.85)",
        fontWeight: 600,
        letterSpacing: 1,
      }}>
        petra-app.com
      </div>
    </AbsoluteFill>
  );
};
