// src/components/teaser/TeaserPainPhase.tsx
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

interface TeaserPainPhaseProps {
  mainText: string;
  subText: string;
  subTextColor?: string;
}

export const TeaserPainPhase: React.FC<TeaserPainPhaseProps> = ({
  mainText,
  subText,
  subTextColor = "#94a3b8",
}) => {
  const frame = useCurrentFrame();

  const bgOpacity = interpolate(frame, [0, 15, 105, 120], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const mainOpacity = interpolate(frame, [10, 30, 105, 120], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mainY = interpolate(frame, [10, 35], [18, 0], { extrapolateRight: "clamp" });

  const subOpacity = interpolate(frame, [35, 55, 105, 120], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (bgOpacity <= 0) return null;

  return (
    <AbsoluteFill
      style={{
        background: "#0f172a",
        opacity: bgOpacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
        zIndex: 100,
      }}
    >
      <div style={{ width: 52, height: 3, background: "#ef4444", borderRadius: 2, marginBottom: 20 }} />
      <div
        style={{
          opacity: mainOpacity,
          transform: `translateY(${mainY}px)`,
          fontSize: 44,
          fontWeight: 800,
          color: "white",
          textAlign: "center",
          lineHeight: 1.3,
          maxWidth: 760,
          marginBottom: 16,
        }}
      >
        {mainText}
      </div>
      <div
        style={{
          opacity: subOpacity,
          fontSize: 22,
          fontWeight: 600,
          color: subTextColor,
          textAlign: "center",
          maxWidth: 640,
        }}
      >
        {subText}
      </div>
    </AbsoluteFill>
  );
};
