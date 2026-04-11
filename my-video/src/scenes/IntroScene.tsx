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

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.4, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const logoScale = spring({ frame, fps, config: { damping: 200 }, delay: 3 });

  const titleProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 200 },
  });
  const titleY = interpolate(titleProgress, [0, 1], [50, 0]);
  const titleOpacity = interpolate(frame, [10, 22], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleProgress = spring({
    frame: frame - 20,
    fps,
    config: { damping: 200 },
  });
  const subtitleY = interpolate(subtitleProgress, [0, 1], [30, 0]);
  const subtitleOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  const badgeOpacity = interpolate(frame, [35, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        background: "linear-gradient(145deg, #ea580c 0%, #c2410c 45%, #7c2d12 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        direction: "rtl",
      }}
    >
      {/* Decorative circles */}
      <div
        style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.07)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -100,
          left: -60,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.05)",
        }}
      />

      {/* Logo */}
      <div
        style={{
          marginBottom: 28,
          transform: `scale(${logoScale})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Img
          src={staticFile("petra-logo.png")}
          style={{
            width: 260,
            height: "auto",
            objectFit: "contain",
            filter: "brightness(0) invert(1)",
          }}
        />
      </div>

      {/* Main title */}
      <h1
        style={{
          color: "white",
          fontSize: 58,
          fontWeight: 800,
          margin: 0,
          marginBottom: 18,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          lineHeight: 1.2,
        }}
      >
        מדריך הדשבורד
      </h1>

      {/* Subtitle */}
      <p
        style={{
          color: "#fed7aa",
          fontSize: 22,
          fontWeight: 400,
          margin: 0,
          textAlign: "center",
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
          maxWidth: 600,
          lineHeight: 1.5,
        }}
      >
        כל מה שצריך לנהל את העסק — במקום אחד
      </p>

      {/* Badge */}
      <div
        style={{
          marginTop: 40,
          background: "rgba(255,255,255,0.15)",
          borderRadius: 30,
          padding: "8px 24px",
          opacity: badgeOpacity,
          border: "1px solid rgba(255,255,255,0.25)",
        }}
      >
        <span style={{ color: "white", fontSize: 15, fontWeight: 500 }}>
          ⏱ 40 שניות · מדריך מהיר
        </span>
      </div>
    </AbsoluteFill>
  );
};
