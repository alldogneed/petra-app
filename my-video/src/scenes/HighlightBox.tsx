import { interpolate, useCurrentFrame } from "remotion";

type Props = {
  x: number;
  y: number;
  width: number;
  height: number;
  startFrame: number;
  endFrame: number;
  borderRadius?: number;
};

export const HighlightBox: React.FC<Props> = ({
  x,
  y,
  width,
  height,
  startFrame,
  endFrame,
  borderRadius = 8,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [startFrame, startFrame + 10, endFrame - 10, endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  if (opacity <= 0.01) return null;

  const pulse = (Math.sin(frame * 0.2) + 1) / 2;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        borderRadius,
        border: `2px solid rgba(234,88,12,${opacity * (0.55 + pulse * 0.45)})`,
        boxShadow: `0 0 0 4px rgba(234,88,12,${opacity * (0.05 + pulse * 0.08)}), 0 0 20px rgba(234,88,12,${opacity * (0.12 + pulse * 0.1)})`,
        pointerEvents: "none",
        zIndex: 500,
      }}
    />
  );
};
