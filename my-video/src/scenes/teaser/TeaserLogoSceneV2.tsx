// src/scenes/teaser/TeaserLogoSceneV2.tsx
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

export const TeaserLogoSceneV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  const logoScale = spring({ frame: frame - 8, fps, config: { damping: 160 } });
  const textOpacity = interpolate(frame, [18, 32], [0, 1], { extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [32, 48], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        opacity: sceneOpacity,
      }}
    >
      <div
        style={{
          transform: `scale(${logoScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 96, height: 96, borderRadius: "50%",
            background: "rgba(234,88,12,0.15)",
            border: "2px solid rgba(234,88,12,0.4)",
            boxShadow: "0 0 40px rgba(234,88,12,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Img
            src={staticFile("petra-icon.png")}
            style={{ width: 62, height: 62, objectFit: "contain" }}
          />
        </div>
        <div style={{ opacity: textOpacity, fontSize: 32, fontWeight: 900, color: "white", letterSpacing: 4 }}>
          PETRA
        </div>
        <div style={{ opacity: subtitleOpacity, fontSize: 20, fontWeight: 600, color: "#94a3b8" }}>
          יש דרך אחרת
        </div>
      </div>
    </AbsoluteFill>
  );
};
