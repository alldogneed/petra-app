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

export const TeaserCTASceneV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sceneOpacity = interpolate(
    frame,
    [0, 20, 210, 240],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const logoScale = spring({ frame: frame - 10, fps, config: { damping: 160 } });

  const ctaOpacity = interpolate(frame, [45, 65], [0, 1], { extrapolateRight: "clamp" });
  const ctaY = interpolate(
    spring({ frame: frame - 45, fps, config: { damping: 200 } }),
    [0, 1], [18, 0]
  );

  const subOpacity = interpolate(frame, [70, 88], [0, 1], { extrapolateRight: "clamp" });
  const urlOpacity = interpolate(frame, [95, 112], [0, 1], { extrapolateRight: "clamp" });

  // Slow heartbeat pulse on main CTA text
  const pulse = 1 + interpolate(frame % 60, [0, 30, 60], [0, 0.012, 0]);

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
      {/* Subtle orange radial glow */}
      <div style={{
        position: "absolute",
        top: "10%", left: "50%",
        transform: "translateX(-50%)",
        width: 600, height: 400,
        background: "radial-gradient(ellipse, rgba(234,88,12,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <div style={{ transform: `scale(${logoScale})`, marginBottom: 24 }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(234,88,12,0.15)",
          border: "2px solid rgba(234,88,12,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 40px rgba(234,88,12,0.2)",
        }}>
          <Img
            src={staticFile("petra-icon.png")}
            style={{ width: 52, height: 52, objectFit: "contain" }}
          />
        </div>
      </div>

      {/* Main CTA */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `translateY(${ctaY}px) scale(${pulse})`,
          fontSize: 52,
          fontWeight: 900,
          color: "white",
          textAlign: "center",
          textShadow: "0 3px 24px rgba(0,0,0,0.3)",
          lineHeight: 1.15,
          marginBottom: 14,
        }}
      >
        נסו חינם עכשיו
      </div>

      {/* Sub CTA — green */}
      <div
        style={{
          opacity: subOpacity,
          fontSize: 22,
          fontWeight: 700,
          color: "#22c55e",
          marginBottom: 18,
          textShadow: "0 0 20px rgba(34,197,94,0.25)",
        }}
      >
        ללא מגבלת זמן
      </div>

      {/* URL */}
      <div
        style={{
          opacity: urlOpacity,
          fontSize: 16,
          fontWeight: 600,
          color: "#94a3b8",
          letterSpacing: 1,
        }}
      >
        petra-app.com
      </div>
    </AbsoluteFill>
  );
};
