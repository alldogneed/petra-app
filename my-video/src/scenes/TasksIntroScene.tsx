// src/scenes/TasksIntroScene.tsx
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

const QUESTIONS = [
  "מי מאכיל את הכלבים בחדר 3?",
  "מי נותן תרופה לנובה ב-18:00?",
  "מי מתקשר ללקוח שחיכה?",
];

export const TasksIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 90, [0, 45, 90], [0, 1, 0]);

  const logoP = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const logoScale = interpolate(logoP, [0, 1], [0.7, 1]);
  const logoOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const labelOpacity = interpolate(frame, [22, 36], [0, 1], { extrapolateRight: "clamp" });

  // Three questions stagger in, each sliding from right
  const questionDelays = [42, 68, 94];

  // "מסונכרן" answer fades in after all questions
  const answerOpacity = interpolate(frame, [130, 148], [0, 1], { extrapolateRight: "clamp" });
  const answerP = spring({ frame: frame - 130, fps, config: { damping: 200 } });
  const answerY = interpolate(answerP, [0, 1], [20, 0]);

  return (
    <AbsoluteFill style={{
      opacity,
      background: `radial-gradient(ellipse at 50% 45%, rgba(234,88,12,${0.08 + pulse * 0.05}) 0%, transparent 60%), linear-gradient(145deg, #0f172a 0%, #1e293b 100%)`,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: FONT, direction: "rtl",
    }}>
      {/* Decorative dots */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${10 + i * 11}%`, left: `${3 + i * 12}%`,
          width: i % 2 === 0 ? 4 : 2, height: i % 2 === 0 ? 4 : 2,
          borderRadius: "50%", background: "rgba(255,255,255,0.15)",
        }} />
      ))}

      {/* Logo */}
      <div style={{
        transform: `scale(${logoScale})`, opacity: logoOpacity,
        marginBottom: 20, display: "flex", alignItems: "center", gap: 10,
      }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 38, height: 38, objectFit: "contain" }} />
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>PETRA</span>
      </div>

      {/* Label */}
      <div style={{
        opacity: labelOpacity,
        background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.5)",
        borderRadius: 99, padding: "5px 16px", marginBottom: 32,
        color: "#fb923c", fontSize: 13, fontWeight: 600,
      }}>
        ניהול משימות
      </div>

      {/* Questions */}
      {QUESTIONS.map((q, i) => {
        const d = questionDelays[i];
        const qOpacity = interpolate(frame, [d, d + 12], [0, 1], { extrapolateRight: "clamp" });
        const qP = spring({ frame: frame - d, fps, config: { damping: 180 } });
        const qX = interpolate(qP, [0, 1], [60, 0]);
        return (
          <div key={q} style={{
            opacity: qOpacity, transform: `translateX(${qX}px)`,
            marginBottom: 14, display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{ color: "#ef4444", fontSize: 26, fontWeight: 900 }}>מי</span>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 22, fontWeight: 600 }}>
              {q.replace("מי ", "")}
            </span>
          </div>
        );
      })}

      {/* Answer */}
      <div style={{
        marginTop: 28, opacity: answerOpacity, transform: `translateY(${answerY}px)`,
        textAlign: "center",
      }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: "white", marginBottom: 6 }}>
          כל הצוות מסונכרן
        </div>
        <div style={{ fontSize: 16, color: "#94a3b8", fontWeight: 500 }}>
          ושום דבר לא נופל בין הכיסאות
        </div>
      </div>
    </AbsoluteFill>
  );
};
