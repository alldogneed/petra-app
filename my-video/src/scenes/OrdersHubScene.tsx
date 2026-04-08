import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";

const CENTER_X = 600;
const CENTER_Y = 330;

const NODES = [
  { label: "לקוח + כלב",      x: 600, y: 120,  delay: 20 },
  { label: "פנסיון",           x: 920, y: 230,  delay: 35 },
  { label: "תהליך אילוף",      x: 920, y: 430,  delay: 50 },
  { label: "תשלום",            x: 600, y: 530,  delay: 65 },
  { label: "תזכורת WhatsApp",  x: 280, y: 330,  delay: 80 },
];

const Node: React.FC<{
  label: string;
  x: number;
  y: number;
  delay: number;
  frame: number;
  fps: number;
}> = ({ label, x, y, delay, frame, fps }) => {
  const progress = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const nodeOpacity = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(progress, [0, 1], [0.7, 1]);

  return (
    <div style={{
      position: "absolute",
      left: x - 72, top: y - 26,
      opacity: nodeOpacity,
      transform: `scale(${scale})`,
      background: "rgba(255,255,255,0.07)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: 12,
      padding: "10px 16px",
      display: "flex", alignItems: "center",
      direction: "rtl",
      width: 144,
      backdropFilter: "blur(4px)",
    }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </div>
  );
};

const ConnectingLine: React.FC<{
  x1: number; y1: number;
  x2: number; y2: number;
  delay: number;
  frame: number;
}> = ({ x1, y1, x2, y2, delay, frame }) => {
  const progress = interpolate(frame, [delay, delay + 18], [0, 1], { extrapolateRight: "clamp" });
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <div style={{
      position: "absolute",
      left: x1, top: y1 - 1,
      width: length * progress,
      height: 2,
      background: "linear-gradient(90deg, rgba(234,88,12,0.6), rgba(234,88,12,0.2))",
      transform: `rotate(${angle}deg)`,
      transformOrigin: "0 50%",
      borderRadius: 2,
    }} />
  );
};

export const OrdersHubScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const centerProgress = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const centerScale = interpolate(centerProgress, [0, 1], [0.6, 1]);
  const centerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  return (
    <AbsoluteFill style={{
      opacity,
      background: `radial-gradient(ellipse at 50% 45%, rgba(234,88,12,${0.08 + pulse * 0.05}) 0%, transparent 60%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
      fontFamily: FONT,
      direction: "rtl",
    }}>
      {/* Connecting lines (drawn before nodes so nodes appear on top) */}
      {NODES.map((node) => (
        <ConnectingLine
          key={node.label}
          x1={CENTER_X} y1={CENTER_Y}
          x2={node.x} y2={node.y}
          delay={node.delay - 8}
          frame={frame}
        />
      ))}

      {/* Center card */}
      <div style={{
        position: "absolute",
        left: CENTER_X - 70, top: CENTER_Y - 36,
        opacity: centerOpacity,
        transform: `scale(${centerScale})`,
        background: "linear-gradient(135deg, #ea580c, #c2410c)",
        borderRadius: 16,
        padding: "16px 28px",
        boxShadow: "0 8px 40px rgba(234,88,12,0.5)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "white" }}>הזמנה</span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>מרכז הניהול</span>
      </div>

      {/* Nodes */}
      {NODES.map((node) => (
        <Node key={node.label} label={node.label} x={node.x} y={node.y} delay={node.delay} frame={frame} fps={fps} />
      ))}

      {/* Bottom label */}
      <div style={{
        position: "absolute",
        bottom: 40, left: 0, right: 0,
        textAlign: "center",
        opacity: interpolate(frame, [90, 105], [0, 1], { extrapolateRight: "clamp" }),
        color: "rgba(255,255,255,0.4)",
        fontSize: 13, fontWeight: 500,
      }}>
        כל הזמנה מניעה את כל המערכות בפטרה
      </div>
    </AbsoluteFill>
  );
};
