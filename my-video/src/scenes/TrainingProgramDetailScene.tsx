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

export const TrainingProgramDetailScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const cardOpacity = interpolate(frame, [14, 28], [0, 1], { extrapolateRight: "clamp" });
  const actionsOpacity = interpolate(frame, [25, 40], [0, 1], { extrapolateRight: "clamp" });
  const detailsOpacity = interpolate(frame, [36, 50], [0, 1], { extrapolateRight: "clamp" });

  const goalsOpacity = interpolate(frame, [55, 70], [0, 1], { extrapolateRight: "clamp" });
  const homeworkOpacity = interpolate(frame, [70, 85], [0, 1], { extrapolateRight: "clamp" });
  const sessionsOpacity = interpolate(frame, [85, 100], [0, 1], { extrapolateRight: "clamp" });

  // Highlight WA button late in the scene
  const waBounce = spring({ frame: frame - 130, fps, config: { damping: 150, stiffness: 300 } });
  const waScale = interpolate(waBounce, [0, 1], [1, 1.08]);
  const waOpacity = interpolate(frame, [125, 140], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול תהליכי אילוף" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity, flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>אימונים וניהול כלבים</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>אילוף בבית הלקוח</div>
          </div>
        </div>

        <div style={{ flex: 1, padding: "16px 24px", display: "flex", flexDirection: "column", gap: 10, overflowY: "hidden" }}>

          {/* Expanded card header */}
          <div style={{
            background: "white", border: "1px solid #e2e8f0", borderRadius: 10,
            padding: "14px 16px", opacity: cardOpacity,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>כוכב</span>
              <span style={{ fontSize: 11, fontWeight: 600, background: "#dcfce7", color: "#16a34a", borderRadius: 99, padding: "2px 8px" }}>פעיל</span>
              <span style={{ fontSize: 11, fontWeight: 600, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "2px 8px" }}>משמעת בסיסית</span>
              <span style={{ marginRight: "auto", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>₪400</span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>ספיר מזרחי · 1/1 מפגשים</div>
            <div style={{ height: 6, background: "#f1f5f9", borderRadius: 99, marginTop: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "100%", background: "#22c55e", borderRadius: 99 }} />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, opacity: actionsOpacity, flexShrink: 0 }}>
            {[
              { label: "⚙ הגדרות", bg: "white", color: "#475569", border: "#e2e8f0" },
              { label: "✓ סיים אילוף", bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
              { label: "✗ נשר מתהליך", bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
            ].map((btn) => (
              <div key={btn.label} style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: btn.bg, color: btn.color, border: `1px solid ${btn.border}`,
              }}>
                {btn.label}
              </div>
            ))}
            {/* WhatsApp report button — highlighted late */}
            <div style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: "#dcfce7", color: "#16a34a", border: "1px solid #86efac",
              opacity: waOpacity, transform: `scale(${waScale})`,
              boxShadow: waOpacity > 0.5 ? "0 0 0 3px rgba(34,197,94,0.2)" : "none",
            }}>
              ✈ שלח דוח בוואטסאפ
            </div>
          </div>

          {/* Details row */}
          <div style={{
            display: "flex", gap: 20, opacity: detailsOpacity,
            background: "white", borderRadius: 10, padding: "12px 16px",
            border: "1px solid #e2e8f0", flexShrink: 0,
          }}>
            {[
              { label: "תאריך התחלה", value: "22 במרץ 2026" },
              { label: "יעד סיום משוער", value: "—" },
              { label: "מיקום", value: "—" },
              { label: "תדירות מפגשים", value: "—" },
            ].map((d) => (
              <div key={d.label}>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>{d.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{d.value}</div>
              </div>
            ))}
          </div>

          {/* Bottom sections */}
          <div style={{ display: "flex", gap: 10, flex: 1, minHeight: 0 }}>
            {/* Goals */}
            <div style={{
              flex: 1, background: "white", borderRadius: 10, border: "1px solid #e2e8f0",
              padding: "12px 14px", opacity: goalsOpacity,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>יעדי אילוף (0)</span>
                <span style={{ fontSize: 11, fontWeight: 600, background: ORANGE, color: "white", borderRadius: 6, padding: "3px 10px" }}>+ הוסף יעד</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 12 }}>
                אין יעדים עדיין — לחץ &quot;הוסף יעד&quot; כדי לעקוב אחר ההתקדמות
              </div>
            </div>

            {/* Homework */}
            <div style={{
              flex: 1, background: "white", borderRadius: 10, border: "1px solid #e2e8f0",
              padding: "12px 14px", opacity: homeworkOpacity,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>שיעורי בית (0/0)</span>
                <span style={{ fontSize: 11, fontWeight: 600, background: "#f1f5f9", color: "#475569", borderRadius: 6, padding: "3px 10px" }}>+ הוסף</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", marginTop: 12 }}>אין שיעורי בית עדיין</div>
            </div>

            {/* Sessions */}
            <div style={{
              flex: 1, background: "white", borderRadius: 10, border: "1px solid #e2e8f0",
              padding: "12px 14px", opacity: sessionsOpacity,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>מפגשים (1/1)</span>
                <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>הכל הושלם ✓</span>
              </div>
              <div style={{
                background: "#f8fafc", borderRadius: 8, padding: "8px 10px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                border: "1px solid #e2e8f0",
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>מפגש 1</span>
                <span style={{ fontSize: 11, color: "#64748b" }}>20 במרץ 2026</span>
              </div>
              <div style={{
                marginTop: 8, background: ORANGE, color: "white",
                borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              }}>
                + מפגש בבית הלקוח
              </div>
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
