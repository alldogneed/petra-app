import React from "react";
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
const SIDEBAR_W = 210;

const ANNOTATIONS = [
  { id: "name", label: "שם הליד", desc: "שם מלא", targetY: 0.14, side: "left" as const, delay: 35 },
  { id: "dog", label: "שם הכלב", desc: "זיהוי מיידי", targetY: 0.28, side: "left" as const, delay: 55 },
  { id: "phone", label: "טלפון", desc: "מספר ישיר", targetY: 0.42, side: "left" as const, delay: 76 },
  { id: "source", label: "מקור", desc: "אתר / גוגל / ידני", targetY: 0.14, side: "right" as const, delay: 97 },
  { id: "service", label: "שירות מבוקש", desc: "מה הלקוח רוצה", targetY: 0.58, side: "right" as const, delay: 118 },
  { id: "date", label: "תאריך פולואפ", desc: "מתי ליצור קשר שוב", targetY: 0.58, side: "left" as const, delay: 140 },
  { id: "note", label: "הערה", desc: "פרטים נוספים", targetY: 0.78, side: "right" as const, delay: 160 },
];

export const SalesLeadCardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const cardProgress = spring({ frame: frame - 5, fps, config: { damping: 200 } });
  const cardScale = interpolate(cardProgress, [0, 1], [0.88, 1]);
  const cardOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });

  const contentW = 1280 - SIDEBAR_W;
  const cardW = 300;
  const cardH = 230;
  const cardX = SIDEBAR_W + (contentW - cardW) / 2 - 30;
  const cardY = (720 - cardH) / 2;

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} />

      {/* Header */}
      <div style={{
        position: "absolute", right: SIDEBAR_W, left: 0, top: 0, height: 52,
        background: "white", borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", padding: "0 24px",
        opacity: interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 11, color: "#94a3b8" }}>לידים</div>
        <span style={{ color: "#cbd5e1", margin: "0 6px", fontSize: 11 }}>/</span>
        <div style={{ fontSize: 12, fontWeight: 700, color: ORANGE }}>כרטיס ליד</div>
      </div>

      {/* Section label */}
      <div style={{
        position: "absolute",
        top: 68,
        right: SIDEBAR_W + 24,
        opacity: interpolate(frame, [8, 22], [0, 1], { extrapolateRight: "clamp" }),
      }}>
        <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500, marginBottom: 4 }}>מבנה כרטיס ליד</div>
        <div style={{ width: 32, height: 3, background: ORANGE, borderRadius: 2 }} />
      </div>

      {/* The lead card */}
      <div style={{
        position: "absolute",
        left: cardX,
        top: cardY,
        width: cardW,
        opacity: cardOpacity,
        transform: `scale(${cardScale})`,
        background: "white",
        borderRadius: 10,
        boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
        border: "1px solid #e2e8f0",
        borderRight: "3px solid #ef4444",
        overflow: "hidden",
        direction: "rtl",
      }}>
        <div style={{ padding: "14px 16px 14px 14px" }}>
          {/* Row 1: name + source */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>ענבל כהן</span>
            <span style={{ fontSize: 10, fontWeight: 700, background: "#dbeafe", color: "#1d4ed8", borderRadius: 5, padding: "2px 8px" }}>
              אתר
            </span>
          </div>

          {/* Row 1.5: dog name */}
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 500 }}>
            🐾 <span style={{ fontWeight: 700, color: "#475569" }}>קיירה</span>
            <span style={{ color: "#94a3b8", fontSize: 10, marginRight: 4 }}>• גולדן רטריבר 5 חודשים</span>
          </div>

          {/* Row 2 - phone */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, color: "#475569", fontSize: 13, direction: "ltr", justifyContent: "flex-end" }}>
            <span>054-321-8876</span>
            <span>📞</span>
          </div>

          {/* Row 3 - service + date */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>📅 9 אפריל</span>
            <span style={{
              background: "#fff7ed", color: ORANGE,
              borderRadius: 6, padding: "3px 10px",
              fontSize: 11, fontWeight: 600,
              border: "1px solid #fed7aa",
            }}>
              אילוף גורים
            </span>
          </div>

          {/* Row 4 - note */}
          <div style={{
            background: "#f8fafc", borderRadius: 7,
            padding: "7px 10px", fontSize: 11, color: "#64748b",
            border: "1px solid #f1f5f9",
          }}>
            "לא יושבת, נובחת על אורחים, לא הייתה אילוף קודם"
          </div>
        </div>
      </div>

      {/* Annotations */}
      {ANNOTATIONS.map((ann) => {
        const annOpacity = interpolate(frame, [ann.delay, ann.delay + 14], [0, 1], { extrapolateRight: "clamp" });
        const annProgress = spring({ frame: frame - ann.delay, fps, config: { damping: 200 } });
        const annShift = interpolate(annProgress, [0, 1], [ann.side === "left" ? 20 : -20, 0]);

        const dotX = cardX + (ann.side === "right" ? cardW : 0);
        const dotY = cardY + ann.targetY * cardH;
        const lineEnd = ann.side === "left" ? dotX - 60 : dotX + 60;
        const labelX = ann.side === "left" ? dotX - 200 : dotX + 68;

        return (
          <React.Fragment key={ann.id}>
            <svg style={{
              position: "absolute", top: 0, left: 0,
              width: 1280, height: 720, pointerEvents: "none",
              opacity: annOpacity,
            }}>
              <circle cx={dotX} cy={dotY} r={4} fill={ORANGE} />
              <line
                x1={dotX} y1={dotY} x2={lineEnd} y2={dotY}
                stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3"
              />
            </svg>

            <div style={{
              position: "absolute",
              top: dotY - 22,
              left: labelX,
              opacity: annOpacity,
              transform: `translateX(${annShift}px)`,
              width: 130,
              textAlign: ann.side === "left" ? "left" : "right",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{ann.label}</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{ann.desc}</div>
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
