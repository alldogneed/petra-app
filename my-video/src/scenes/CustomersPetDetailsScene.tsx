import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;
const ORANGE = "#ea580c";

const PET_FIELDS = [
  { label: "שם", value: "מיקי", delay: 20 },
  { label: "גזע", value: "גולדן רטריבר", delay: 32 },
  { label: "מין", value: "זכר", delay: 44 },
  { label: "תאריך לידה", value: "14.3.2022 (2 שנים)", delay: 56 },
  { label: "צבע", value: "זהוב", delay: 68 },
  { label: "מסורס", value: "כן", delay: 80 },
  { label: "מיקרוצ'יפ", value: "981000012345678", delay: 92 },
  { label: "הערות רפואיות", value: "אלרגי לעוף, חיסון כלבת עד 3/2025", delay: 104 },
];

// Annotation labels with arrows
const ANNOTATIONS: { text: string; top: number; right: number; delay: number }[] = [
  { text: "שם החיה", top: 12, right: -130, delay: 20 },
  { text: "גזע + גיל", top: 22, right: -140, delay: 38 },
  { text: "מין", top: 32, right: -120, delay: 50 },
  { text: "תאריך לידה מחושב", top: 42, right: -160, delay: 62 },
  { text: "מיקרוצ'יפ לזיהוי", top: 65, right: -160, delay: 98 },
  { text: "הערות + חיסונים", top: 75, right: -150, delay: 110 },
];

export const CustomersPetDetailsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="לקוחות" />

      <div style={{ marginRight: SIDEBAR_W, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: "0 32px", height: 56, display: "flex", alignItems: "center", gap: 8, opacity: headerOpacity }}>
          <span style={{ color: "#64748b", fontSize: 12 }}>לקוחות</span>
          <span style={{ color: "#94a3b8" }}>›</span>
          <span style={{ color: "#64748b", fontSize: 12 }}>דנה לוי</span>
          <span style={{ color: "#94a3b8" }}>›</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>מיקי</span>
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px 40px" }}>
          <div style={{ display: "flex", gap: 40, alignItems: "flex-start", maxWidth: 860, width: "100%" }}>

            {/* Pet card */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  background: "white",
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                  width: 340,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
                  overflow: "hidden",
                }}
              >
                {/* Card header */}
                <div
                  style={{
                    background: `linear-gradient(135deg, ${ORANGE}15, ${ORANGE}05)`,
                    borderBottom: "1px solid #e2e8f0",
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      background: `${ORANGE}20`,
                      border: `2px solid ${ORANGE}40`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                    color: ORANGE,
                    fontWeight: 800,
                    }}
                  >
                    מ
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>מיקי</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>גולדן רטריבר · 2 שנים</div>
                  </div>
                </div>

                {/* Fields */}
                <div style={{ padding: "14px 20px" }}>
                  {PET_FIELDS.map((field) => {
                    const fOpacity = interpolate(frame, [field.delay, field.delay + 14], [0, 1], { extrapolateRight: "clamp" });
                    return (
                      <div
                        key={field.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 0",
                          borderBottom: "1px solid #f1f5f9",
                          opacity: fOpacity,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{field.label}</span>
                        </div>
                        <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600, maxWidth: 160, textAlign: "left" }}>{field.value}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right side: annotations */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 0, paddingTop: 60 }}>
              {ANNOTATIONS.map((ann, i) => {
                const annOpacity = interpolate(frame, [ann.delay + 5, ann.delay + 18], [0, 1], { extrapolateRight: "clamp" });
                return (
                  <div
                    key={i}
                    style={{
                      opacity: annOpacity,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 18,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: ORANGE,
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        height: 1,
                        width: 32,
                        background: `${ORANGE}60`,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: ORANGE,
                        background: `${ORANGE}10`,
                        border: `1px solid ${ORANGE}30`,
                        borderRadius: 6,
                        padding: "3px 10px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ann.text}
                    </span>
                  </div>
                );
              })}

              {/* Summary badge */}
              <div
                style={{
                  opacity: interpolate(frame, [125, 138], [0, 1], { extrapolateRight: "clamp" }),
                  background: "linear-gradient(135deg, #0f172a, #1e293b)",
                  borderRadius: 12,
                  padding: "14px 18px",
                  color: "white",
                  marginTop: 8,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>כל המידע הרפואי</div>
                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                  חיסונים, הערות, שבב —<br />הכל נגיש בלחיצה אחת
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
