// src/scenes/BookingIntroScene.tsx
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
const ORANGE = "#ea580c";

// Phase 1: 0-130 — chaos lines slide in
// Phase 2: 130-end — badge + subtitle (cross-fade)
const PHASE2_START = 130;

export const BookingIntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const pulse = interpolate(frame % 60, [0, 30, 60], [0, 1, 0]);

  // Phase 1 lines (slide in from right in RTL direction = slide in from left in CSS)
  const line1P = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  const line1X = interpolate(line1P, [0, 1], [-60, 0]);
  const line1Opacity = interpolate(frame, [8, 22], [0, 1], { extrapolateRight: "clamp" });

  const line2P = spring({ frame: frame - 30, fps, config: { damping: 200 } });
  const line2X = interpolate(line2P, [0, 1], [-60, 0]);
  const line2Opacity = interpolate(frame, [30, 44], [0, 1], { extrapolateRight: "clamp" });

  const line3P = spring({ frame: frame - 55, fps, config: { damping: 200 } });
  const line3X = interpolate(line3P, [0, 1], [-60, 0]);
  const line3Opacity = interpolate(frame, [55, 70], [0, 1], { extrapolateRight: "clamp" });

  // Cross-fade between phase 1 and phase 2
  const phase1Opacity = interpolate(frame, [PHASE2_START - 15, PHASE2_START], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const phase2Opacity = interpolate(frame, [PHASE2_START - 5, PHASE2_START + 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Phase 2 elements
  const badgeP = spring({ frame: frame - PHASE2_START, fps, config: { damping: 200 } });
  const badgeScale = interpolate(badgeP, [0, 1], [0.8, 1]);
  const subtitleOpacity = interpolate(frame, [PHASE2_START + 20, PHASE2_START + 35], [0, 1], { extrapolateRight: "clamp" });

  // Logo bottom-right
  const logoOpacity = interpolate(frame, [PHASE2_START + 25, PHASE2_START + 40], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      opacity,
      background: "linear-gradient(145deg, #0f172a 0%, #1e293b 60%, #0c1422 100%)",
      fontFamily: FONT,
      direction: "rtl",
    }}>
      {/* Background glow */}
      <div style={{
        position: "absolute",
        top: "25%", left: "50%",
        transform: "translateX(-50%)",
        width: 700, height: 500,
        background: `radial-gradient(ellipse, rgba(234,88,12,${0.08 + pulse * 0.04}) 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      {/* Decorative dots */}
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute",
          top: `${10 + i * 11}%`, left: `${3 + i * 12}%`,
          width: i % 2 === 0 ? 4 : 2, height: i % 2 === 0 ? 4 : 2,
          borderRadius: "50%", background: "rgba(255,255,255,0.15)",
        }} />
      ))}

      {/* Phase 1 — Chaos lines */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 20, opacity: phase1Opacity,
      }}>
        <div style={{
          color: "white", fontSize: 44, fontWeight: 800,
          opacity: line1Opacity, transform: `translateX(${line1X}px)`,
          textAlign: "center",
        }}>
          הלקוח שולח הודעה
        </div>
        <div style={{
          color: "#94a3b8", fontSize: 28, fontWeight: 600,
          opacity: line2Opacity, transform: `translateX(${line2X}px)`,
          textAlign: "center",
        }}>
          אתם עונים, מתאמים, ומאשרים...
        </div>
        <div style={{
          color: "#ef4444", fontSize: 28, fontWeight: 700,
          opacity: line3Opacity, transform: `translateX(${line3X}px)`,
          textAlign: "center",
        }}>
          ועוד אחד. ועוד אחד.
        </div>
      </div>

      {/* Phase 2 — Solution badge */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 20, opacity: phase2Opacity,
      }}>
        <div style={{
          transform: `scale(${badgeScale})`,
          background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
          borderRadius: 16, padding: "14px 36px",
          boxShadow: "0 8px 32px rgba(234,88,12,0.4)",
        }}>
          <span style={{ color: "white", fontSize: 36, fontWeight: 800 }}>הזמנות אונליין</span>
        </div>
        <div style={{
          color: "#94a3b8", fontSize: 22, fontWeight: 600,
          opacity: subtitleOpacity, textAlign: "center",
        }}>
          לקוחות קובעים לבד — עשרים וארבע שבע
        </div>
      </div>

      {/* Petra logo bottom-right */}
      <div style={{
        position: "absolute", bottom: 28, left: 32,
        display: "flex", alignItems: "center", gap: 8,
        opacity: logoOpacity,
      }}>
        <Img src={staticFile("petra-icon.png")} style={{ width: 28, height: 28, objectFit: "contain" }} />
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: 600 }}>PETRA</span>
      </div>
    </AbsoluteFill>
  );
};
