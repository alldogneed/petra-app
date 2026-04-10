// src/scenes/DashboardChecklistScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const SIDEBAR_W = 210;

const CHECKLIST_ITEMS = [
  { label: "הגדרת פרטי העסק",        done: true },
  { label: "הוספת שירות ראשון",       done: true },
  { label: "הוספת לקוח ראשון",        done: true },
  { label: "קביעת תור ראשון",         done: true },
  { label: "יצירת הזמנה",             done: false },
  { label: "הגדרת חוזה לדוגמה",      done: false },
  { label: "הפעלת תזכורות WhatsApp", done: false },
];

const COMPLETED_COUNT = CHECKLIST_ITEMS.filter((i) => i.done).length;

export const DashboardChecklistScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  // Progress bar fills from 0 → (4/7) as items arrive
  const progressWidth = interpolate(
    frame,
    [20, 20 + 6 * 35 + 30],
    [0, COMPLETED_COUNT / CHECKLIST_ITEMS.length],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="דשבורד" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Page header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          opacity: headerOpacity,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לוח הבקרה</div>
        </div>

        <div style={{ padding: "20px 24px" }}>

          {/* Section heading + counter */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 12, opacity: headerOpacity,
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>צ'קליסט הקמה</div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>
              {COMPLETED_COUNT}/{CHECKLIST_ITEMS.length} הושלמו
            </div>
          </div>

          {/* Progress bar */}
          <div style={{
            height: 8, background: "#e2e8f0", borderRadius: 99,
            marginBottom: 16, overflow: "hidden",
            opacity: headerOpacity,
          }}>
            <div style={{
              height: "100%", borderRadius: 99,
              width: `${progressWidth * 100}%`,
              background: "linear-gradient(90deg, #ea580c, #16a34a)",
            }} />
          </div>

          {/* Checklist items */}
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden" }}>
            {CHECKLIST_ITEMS.map((item, i) => {
              const startFrame = 20 + i * 35;
              const rowP = spring({ frame: frame - startFrame, fps, config: { damping: 200 } });
              const rowX = interpolate(rowP, [0, 1], [-40, 0]);
              const rowOpacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], { extrapolateRight: "clamp" });

              const checkP = spring({ frame: frame - startFrame - 5, fps, config: { damping: 200 } });
              const checkScale = interpolate(checkP, [0, 1], [0.5, 1]);

              return (
                <div key={item.label} style={{
                  display: "flex", alignItems: "center", gap: 14, padding: "13px 18px",
                  borderBottom: i < CHECKLIST_ITEMS.length - 1 ? "1px solid #f1f5f9" : "none",
                  background: item.done ? "rgba(22,163,74,0.04)" : "white",
                  opacity: rowOpacity,
                  transform: `translateX(${rowX}px)`,
                }}>
                  {/* Check icon */}
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%",
                    background: item.done ? "#16a34a" : "white",
                    border: item.done ? "none" : "2px solid #cbd5e1",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    transform: `scale(${item.done ? checkScale : 1})`,
                  }}>
                    {item.done && (
                      <span style={{ color: "white", fontSize: 12, fontWeight: 800 }}>✓</span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: item.done ? 600 : 500,
                    color: item.done ? "#166534" : "#475569",
                  }}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
