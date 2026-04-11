// src/scenes/PetsFamilyScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";

const PETS = [
  { emoji: "🐕", name: "רקסי", breed: "גולדן רטריבר", age: "4 שנים" },
  { emoji: "🐈", name: "מיאו", breed: "פרסי", age: "2 שנים" },
  { emoji: "🐦", name: "ציוצי", breed: "קנרית", age: "1 שנה" },
  { emoji: "🐇", name: "פומפום", breed: "ארנב גמד", age: "6 חודשים" },
];

export const PetsFamilyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Customer card slides in
  const customerP = spring({ frame: frame - 5, fps, config: { damping: 180 } });
  const customerY = interpolate(customerP, [0, 1], [-20, 0]);
  const customerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  // Section heading
  const sectionOpacity = interpolate(frame, [20, 34], [0, 1], { extrapolateRight: "clamp" });

  // Callout
  const calloutOpacity = interpolate(frame, [210, 228], [0, 1], { extrapolateRight: "clamp" });
  const calloutP = spring({ frame: frame - 210, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [16, 0]);

  return (
    <AbsoluteFill style={{ opacity, background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar */}
      <PetraSidebar activeLabel="לקוחות" />

      {/* Content area */}
      <div style={{
        position: "absolute",
        top: 0, right: 210, left: 0, bottom: 0,
        padding: "20px 28px",
        overflow: "hidden",
      }}>
        {/* Customer card */}
        <div style={{
          background: "white",
          borderRadius: 14,
          padding: "16px 20px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
          display: "flex", alignItems: "center", gap: 14,
          marginBottom: 20,
          direction: "rtl",
          opacity: customerOpacity,
          transform: `translateY(${customerY}px)`,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 800, color: "white",
          }}>מ</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>משפחת לוי</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>לקוח פעיל</div>
          </div>
        </div>

        {/* Pets section heading */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 14, opacity: sectionOpacity,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>חיות מחמד (4)</span>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: 18, fontWeight: 400,
          }}>+</div>
        </div>

        {/* Pet cards */}
        {PETS.map((pet, i) => {
          const delay = 38 + i * 18;
          const pOpacity = interpolate(frame, [delay, delay + 14], [0, 1], { extrapolateRight: "clamp" });
          const pP = spring({ frame: frame - delay, fps, config: { damping: 180 } });
          const pY = interpolate(pP, [0, 1], [20, 0]);

          return (
            <div key={pet.name} style={{
              background: "white",
              borderRadius: 12,
              padding: "14px 18px",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
              marginBottom: 10,
              display: "flex", alignItems: "center", gap: 14,
              direction: "rtl",
              opacity: pOpacity,
              transform: `translateY(${pY}px)`,
              borderRight: `3px solid ${ORANGE}`,
            }}>
              <span style={{ fontSize: 28 }}>{pet.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{pet.name}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{pet.breed} · {pet.age}</div>
              </div>
            </div>
          );
        })}

        {/* Orange callout */}
        <div style={{
          marginTop: 6,
          background: "rgba(234,88,12,0.08)",
          border: `1.5px solid rgba(234,88,12,0.25)`,
          borderRadius: 12,
          padding: "12px 18px",
          opacity: calloutOpacity,
          transform: `translateY(${calloutY}px)`,
        }}>
          <span style={{ fontSize: 13, color: ORANGE, fontWeight: 600 }}>
            כל החיות מקושרות לאותו לקוח — כל תור, הזמנה ורשומה בפרופיל אחד
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
