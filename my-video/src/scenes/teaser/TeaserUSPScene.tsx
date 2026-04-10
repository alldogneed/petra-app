import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

export const TeaserUSPScene: React.FC = () => {
  const frame = useCurrentFrame();

  const sceneOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  const line1Opacity = interpolate(frame, [22, 45], [0, 1], { extrapolateRight: "clamp" });
  const line1Y = interpolate(frame, [22, 48], [16, 0], { extrapolateRight: "clamp" });

  const line2Opacity = interpolate(frame, [60, 82], [0, 1], { extrapolateRight: "clamp" });
  const line2Y = interpolate(frame, [60, 85], [16, 0], { extrapolateRight: "clamp" });

  const line3Opacity = interpolate(frame, [100, 120], [0, 1], { extrapolateRight: "clamp" });
  const line3Y = interpolate(frame, [100, 122], [12, 0], { extrapolateRight: "clamp" });

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
          width: 52, height: 3, background: "#ea580c",
          borderRadius: 2, marginBottom: 28, opacity: line1Opacity,
        }}
      />
      <div
        style={{
          opacity: line1Opacity,
          transform: `translateY(${line1Y}px)`,
          fontSize: 50,
          fontWeight: 900,
          color: "white",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        המערכת היחידה
      </div>
      <div
        style={{
          opacity: line2Opacity,
          transform: `translateY(${line2Y}px)`,
          fontSize: 50,
          fontWeight: 900,
          color: "#ea580c",
          textAlign: "center",
          textShadow: "0 0 40px rgba(234,88,12,0.3)",
          marginBottom: 20,
        }}
      >
        שנבנתה מהשטח
      </div>
      <div
        style={{
          opacity: line3Opacity,
          transform: `translateY(${line3Y}px)`,
          fontSize: 24,
          fontWeight: 600,
          color: "#94a3b8",
          textAlign: "center",
        }}
      >
        עם אנשים שמכירים בע״ח
      </div>
    </AbsoluteFill>
  );
};
