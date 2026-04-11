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

export const TeaserLogoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame: frame - 2, fps, config: { damping: 160 } });

  const textOpacity = interpolate(frame, [10, 22], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = interpolate(frame, [20, 32], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
      }}
    >
      {/* Logo + brand */}
      <div
        style={{
          transform: `scale(${logoScale})`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{
          width: 96, height: 96, borderRadius: "50%",
          background: "white",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Img
            src={staticFile("petra-icon.png")}
            style={{ width: 62, height: 62, objectFit: "contain" }}
          />
        </div>
        <div
          style={{
            opacity: textOpacity,
            fontSize: 32,
            fontWeight: 900,
            color: "white",
            letterSpacing: 4,
          }}
        >
          PETRA
        </div>
        <div
          style={{
            opacity: subtitleOpacity,
            fontSize: 18,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          הפתרון כאן
        </div>
      </div>
    </AbsoluteFill>
  );
};
