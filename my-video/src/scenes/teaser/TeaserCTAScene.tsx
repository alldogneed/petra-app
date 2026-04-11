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

  const logoScale = spring({ frame: frame - 2, fps, config: { damping: 160 } });

  const tagOpacity = interpolate(frame, [6, 16], [0, 1], { extrapolateRight: "clamp" });
  const tagY = interpolate(spring({ frame: frame - 6, fps, config: { damping: 200 } }), [0, 1], [14, 0]);

  const mainOpacity = interpolate(frame, [14, 26], [0, 1], { extrapolateRight: "clamp" });
  const mainY = interpolate(spring({ frame: frame - 14, fps, config: { damping: 200 } }), [0, 1], [18, 0]);

  const subOpacity = interpolate(frame, [24, 36], [0, 1], { extrapolateRight: "clamp" });
  const urlOpacity = interpolate(frame, [32, 44], [0, 1], { extrapolateRight: "clamp" });

  const pulse = 1 + interpolate(frame % 30, [0, 15, 30], [0, 0.015, 0]);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(145deg, #ea580c 0%, #b63a07 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        gap: 0,
      }}
    >
      {/* Radial shine */}
      <div style={{
        position: "absolute",
        top: "5%", left: "50%",
        transform: "translateX(-50%)",
        width: 700, height: 500,
        background: "radial-gradient(ellipse, rgba(255,255,255,0.13) 0%, transparent 68%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <div style={{ transform: `scale(${logoScale})`, marginBottom: 18 }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 68, height: 68, objectFit: "contain" }} />
      </div>

      {/* Tagline */}
      <div style={{
        opacity: tagOpacity,
        transform: `translateY(${tagY}px)`,
        fontSize: 16,
        fontWeight: 700,
        color: "rgba(255,255,255,0.75)",
        letterSpacing: 2,
        textTransform: "uppercase",
        marginBottom: 12,
      }}>
        PETRA — ניהול עסק חיות המחמד
      </div>

      {/* Main CTA */}
      <div style={{
        opacity: mainOpacity,
        transform: `translateY(${mainY}px) scale(${pulse})`,
        fontSize: 50,
        fontWeight: 900,
        color: "white",
        textAlign: "center",
        textShadow: "0 3px 24px rgba(0,0,0,0.25)",
        lineHeight: 1.2,
        marginBottom: 10,
      }}>
        מחזירים לך את השליטה לעסק
      </div>

      {/* Sub CTA */}
      <div style={{
        opacity: subOpacity,
        fontSize: 22,
        fontWeight: 700,
        color: "rgba(255,255,255,0.92)",
        marginBottom: 18,
      }}>
        התחל עכשיו בחינם — ללא כרטיס אשראי
      </div>

      {/* URL */}
      <div style={{
        opacity: urlOpacity,
        fontSize: 16,
        fontWeight: 600,
        color: "rgba(255,255,255,0.6)",
        letterSpacing: 1,
      }}>
        petra-app.com
      </div>
    </AbsoluteFill>
  );
};
