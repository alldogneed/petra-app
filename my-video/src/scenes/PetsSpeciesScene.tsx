// src/scenes/PetsSpeciesScene.tsx
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

const SPECIES = [
  { emoji: "🐕", name: "כלב", breeds: "Golden Retriever, לברדור, פודל ועוד" },
  { emoji: "🐈", name: "חתול", breeds: "פרסי, סיאמי, מיקס ועוד" },
  { emoji: "🐦", name: "ציפור", breeds: "תוכי, קנרית, זבוב ועוד" },
  { emoji: "🐇", name: "ארנב", breeds: "ארנב גמד, אנגורה ועוד" },
];

export const PetsSpeciesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Header slides down
  const headerP = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const headerY = interpolate(headerP, [0, 1], [-20, 0]);
  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });

  // Section title fades
  const sectionOpacity = interpolate(frame, [18, 30], [0, 1], { extrapolateRight: "clamp" });

  // Callout at bottom
  const calloutOpacity = interpolate(frame, [90, 105], [0, 1], { extrapolateRight: "clamp" });
  const calloutP = spring({ frame: frame - 90, fps, config: { damping: 200 } });
  const calloutY = interpolate(calloutP, [0, 1], [16, 0]);

  return (
    <AbsoluteFill style={{ opacity, background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar on the right */}
      <PetraSidebar activeLabel="חיות מחמד" />

      {/* Content area — left of sidebar */}
      <div style={{
        position: "absolute",
        top: 0, right: 210, left: 0, bottom: 0,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header bar */}
        <div style={{
          height: 52, background: "white",
          borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center",
          padding: "0 24px",
          opacity: headerOpacity,
          transform: `translateY(${headerY}px)`,
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>חיות מחמד</span>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: "24px 28px", overflow: "hidden" }}>
          {/* Section heading */}
          <div style={{ marginBottom: 20, opacity: sectionOpacity }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
              סוגי בעלי חיים נתמכים
            </span>
          </div>

          {/* 2×2 grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 680 }}>
            {SPECIES.map((sp, i) => {
              const cardDelay = 30 + i * 14;
              const cardP = spring({ frame: frame - cardDelay, fps, config: { damping: 180 } });
              const cardY = interpolate(cardP, [0, 1], [24, 0]);
              const cardOpacity = interpolate(frame, [cardDelay, cardDelay + 14], [0, 1], { extrapolateRight: "clamp" });

              return (
                <div key={sp.name} style={{
                  background: "white",
                  borderRadius: 14,
                  padding: "20px 20px 20px 20px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  borderTop: `3px solid ${ORANGE}`,
                  opacity: cardOpacity,
                  transform: `translateY(${cardY}px)`,
                  direction: "rtl",
                }}>
                  <div style={{ fontSize: 40, marginBottom: 10, lineHeight: 1 }}>{sp.emoji}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>{sp.name}</div>
                  <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{sp.breeds}</div>
                </div>
              );
            })}
          </div>

          {/* Orange callout */}
          <div style={{
            marginTop: 24,
            background: "rgba(234,88,12,0.08)",
            border: `1.5px solid rgba(234,88,12,0.25)`,
            borderRadius: 12,
            padding: "13px 18px",
            maxWidth: 680,
            opacity: calloutOpacity,
            transform: `translateY(${calloutY}px)`,
          }}>
            <span style={{ fontSize: 14, color: ORANGE, fontWeight: 600 }}>
              לא מוגבל לכלבים — בחרו את סוג החיה בעת יצירת הפרופיל
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
