// src/scenes/PetsProfileScene.tsx
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

const FIELDS = [
  { label: "סוג", value: "ציפור" },
  { label: "גזע", value: "תוכי אמזוני" },
  { label: "מין", value: "נקבה" },
  { label: "תאריך לידה", value: "05.06.2022 (3 שנים)" },
  { label: "מיקרוצ'יפ", value: "972000098765" },
  { label: "הערות רפואיות", value: "רגיש לאבק, חיסון מנטוקס עד 06/2026" },
];

const ANNOTATIONS = [
  { label: "סוג בעל החיים", topPercent: 20 },
  { label: "גיל מחושב אוטומטית", topPercent: 41 },
  { label: "מיקרוצ'יפ לזיהוי", topPercent: 60 },
  { label: "הערות רפואיות + חיסונים", topPercent: 79 },
];

export const PetsProfileScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Breadcrumb
  const breadcrumbOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });

  // Profile card slides up
  const cardP = spring({ frame: frame - 10, fps, config: { damping: 180 } });
  const cardY = interpolate(cardP, [0, 1], [30, 0]);
  const cardOpacity = interpolate(frame, [10, 26], [0, 1], { extrapolateRight: "clamp" });

  // Summary dark card at bottom
  const summaryOpacity = interpolate(frame, [220, 240], [0, 1], { extrapolateRight: "clamp" });
  const summaryP = spring({ frame: frame - 220, fps, config: { damping: 200 } });
  const summaryY = interpolate(summaryP, [0, 1], [20, 0]);

  return (
    <AbsoluteFill style={{ opacity, background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar */}
      <PetraSidebar activeLabel="לקוחות" />

      {/* Content area */}
      <div style={{
        position: "absolute",
        top: 0, right: 210, left: 0, bottom: 0,
        padding: "20px 24px",
        overflow: "hidden",
      }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16, opacity: breadcrumbOpacity }}>
          לקוחות › רחל כהן › <span style={{ color: ORANGE, fontWeight: 600 }}>פיפי</span>
        </div>

        {/* Layout: card left, annotations right */}
        <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
          {/* Profile card */}
          <div style={{
            flex: 1,
            background: "white",
            borderRadius: 16,
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            overflow: "hidden",
            opacity: cardOpacity,
            transform: `translateY(${cardY}px)`,
          }}>
            {/* Header */}
            <div style={{
              background: `linear-gradient(135deg, ${ORANGE}15, ${ORANGE}08)`,
              borderBottom: "1px solid #f1f5f9",
              padding: "20px 24px",
              display: "flex", alignItems: "center", gap: 16,
              direction: "rtl",
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: `linear-gradient(135deg, ${ORANGE}, #c2410c)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 800, color: "white",
              }}>פ</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>פיפי</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>תוכי אמזוני · 3 שנים</div>
              </div>
            </div>

            {/* Fields */}
            <div style={{ padding: "16px 24px" }}>
              {FIELDS.map((field, i) => {
                const delay = 40 + i * 14;
                const fOpacity = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });
                const fP = spring({ frame: frame - delay, fps, config: { damping: 200 } });
                const fY = interpolate(fP, [0, 1], [10, 0]);
                return (
                  <div key={field.label} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom: i < FIELDS.length - 1 ? "1px solid #f1f5f9" : "none",
                    opacity: fOpacity,
                    transform: `translateY(${fY}px)`,
                    direction: "rtl",
                  }}>
                    <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{field.label}</span>
                    <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600, maxWidth: 200, textAlign: "left" }}>{field.value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Annotations */}
          <div style={{ width: 200, position: "relative", height: 360 }}>
            {ANNOTATIONS.map((ann, i) => {
              const annDelay = 80 + i * 25;
              const annOpacity = interpolate(frame, [annDelay, annDelay + 14], [0, 1], { extrapolateRight: "clamp" });
              const annP = spring({ frame: frame - annDelay, fps, config: { damping: 200 } });
              const annX = interpolate(annP, [0, 1], [20, 0]);
              return (
                <div key={ann.label} style={{
                  position: "absolute",
                  top: `${ann.topPercent}%`,
                  left: 0,
                  display: "flex", alignItems: "center", gap: 8,
                  opacity: annOpacity,
                  transform: `translateX(${annX}px)`,
                  direction: "ltr",
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE, flexShrink: 0 }} />
                  <div style={{
                    fontSize: 12, color: ORANGE, fontWeight: 600,
                    background: "rgba(234,88,12,0.08)",
                    borderRadius: 8, padding: "4px 10px",
                    whiteSpace: "nowrap",
                  }}>{ann.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Summary dark card */}
        <div style={{
          marginTop: 16,
          background: "#1e293b",
          borderRadius: 12,
          padding: "14px 20px",
          opacity: summaryOpacity,
          transform: `translateY(${summaryY}px)`,
        }}>
          <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>
            כל המידע הרפואי — חיסונים, הערות, שבב — הכל נגיש בלחיצה אחת
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
