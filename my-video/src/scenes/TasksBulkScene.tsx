// src/scenes/TasksBulkScene.tsx
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

// Timeline
const SELECT_MODE_ON = 35;   // "בחר" clicked, checkboxes appear
const CHECK_1        = 60;   // task 1 checked
const CHECK_2        = 78;   // task 2 checked
const CHECK_3        = 96;   // task 3 checked
const BULK_COMPLETE  = 130;  // "סמן כהושלם" clicked
const TASKS_DONE     = 142;  // tasks show completed
const SELECT_MODE_2  = 220;  // second selection batch
const CHECK_4        = 248;
const CHECK_5        = 264;
const DIALOG_OPEN    = 310;

const STATUS_DOT: Record<string, string> = {
  overdue: "#ef4444", active: "#22c55e", scheduled: "#94a3b8", done: "#bbf7d0",
};
const STATUS_LABEL: Record<string, string> = {
  overdue: "באיחור", active: "עכשיו", scheduled: "מתוכנן", done: "הושלם",
};
const PRIORITY_COLOR: Record<string, string> = {
  "דחופה": "#ef4444", "גבוהה": "#ea580c", "בינונית": "#3b82f6", "נמוכה": "#94a3b8",
};

const TASKS = [
  { title: "מתן תרופה לנובה",     priority: "דחופה",  due: "היום 18:00",  status: "overdue"   as const, checkFrame: CHECK_1 },
  { title: "האכלה — חדר 3",        priority: "גבוהה",  due: "עכשיו",       status: "active"    as const, checkFrame: CHECK_2 },
  { title: "צ׳ק-אאוט — מקס",       priority: "בינונית",due: "מחר 10:00",  status: "scheduled" as const, checkFrame: CHECK_3 },
  { title: "שיחה עם ענבל כהן",    priority: "נמוכה",  due: "אתמול",       status: "done"      as const, checkFrame: CHECK_4 },
  { title: "בדיקת חיסון — קיירה", priority: "גבוהה",  due: "מחרתיים",     status: "scheduled" as const, checkFrame: CHECK_5 },
];

export const TasksBulkScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [4, 16], [0, 1], { extrapolateRight: "clamp" });

  const selectModeActive = frame >= SELECT_MODE_ON && frame < SELECT_MODE_2 - 10;
  const selectMode2Active = frame >= SELECT_MODE_2;
  const checkboxVisible = selectModeActive || selectMode2Active;

  // Which tasks are checked in each batch
  const batch1Checked = (i: number) => selectModeActive && frame >= TASKS[i]?.checkFrame;
  const batch2Checked = (i: number) => selectMode2Active && i >= 3 && frame >= TASKS[i]?.checkFrame;
  const isChecked = (i: number) => batch1Checked(i) || batch2Checked(i);

  // After bulk complete, first 3 tasks show as done
  const isCompleted = (i: number) => i < 3 && frame >= TASKS_DONE;

  // Bulk action bar visibility
  const bulkBarOpacity1 = interpolate(frame, [CHECK_1, CHECK_1 + 10], [0, 1], { extrapolateRight: "clamp" })
    * interpolate(frame, [TASKS_DONE + 5, TASKS_DONE + 15], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bulkBarOpacity2 = interpolate(frame, [CHECK_4, CHECK_4 + 10], [0, 1], { extrapolateRight: "clamp" })
    * interpolate(frame, [DIALOG_OPEN, DIALOG_OPEN + 10], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Postpone dialog
  const dialogOpacity = interpolate(frame, [DIALOG_OPEN, DIALOG_OPEN + 12], [0, 1], { extrapolateRight: "clamp" });
  const dialogP = spring({ frame: frame - DIALOG_OPEN, fps, config: { damping: 200 } });
  const dialogScale = interpolate(dialogP, [0, 1], [0.93, 1]);

  // "סמן כהושלם" button pulse
  const completePulse = interpolate(frame, [BULK_COMPLETE, BULK_COMPLETE + 4, BULK_COMPLETE + 9], [1, 0.93, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול משימות" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          background: "white", borderBottom: "1px solid #e2e8f0",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          opacity: headerOpacity,
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>+ משימה חדשה</div>
            <div style={{
              background: checkboxVisible ? "#fef2f2" : "#f8fafc",
              color: checkboxVisible ? "#dc2626" : "#64748b",
              border: `1.5px solid ${checkboxVisible ? "#fca5a5" : "#e2e8f0"}`,
              borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700,
            }}>
              {checkboxVisible ? "ביטול" : "בחר"}
            </div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>משימות</div>
        </div>

        {/* Bulk action bar */}
        {(bulkBarOpacity1 > 0.01 || bulkBarOpacity2 > 0.01) && (
          <div style={{
            background: "#0f172a",
            padding: "10px 24px",
            display: "flex", alignItems: "center", gap: 10,
            opacity: Math.max(bulkBarOpacity1, bulkBarOpacity2),
          }}>
            <span style={{ color: "white", fontSize: 13, fontWeight: 700, flex: 1 }}>
              {frame >= SELECT_MODE_2 ? "2 נבחרו" : "3 נבחרו"}
            </span>
            {bulkBarOpacity1 > 0.01 && (
              <div style={{
                background: "#22c55e", color: "white", borderRadius: 8,
                padding: "6px 14px", fontSize: 12, fontWeight: 700,
                transform: `scale(${completePulse})`,
              }}>
                סמן כהושלם
              </div>
            )}
            {bulkBarOpacity2 > 0.01 && (
              <div style={{ background: "#3b82f6", color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>
                דחה תאריך
              </div>
            )}
            <div style={{ background: "#ef4444", color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>מחק</div>
          </div>
        )}

        {/* Task list */}
        <div style={{ padding: "12px 24px" }}>
          {TASKS.map((task, i) => {
            const rowOpacity = interpolate(frame, [12 + i * 10, 24 + i * 10], [0, 1], { extrapolateRight: "clamp" });
            const completed = isCompleted(i);
            const checked = isChecked(i);
            const effectiveStatus = completed ? "done" : task.status;

            return (
              <div key={task.title} style={{
                background: checked ? "rgba(234,88,12,0.04)" : "white",
                borderRadius: 10,
                border: `1px solid ${checked ? "rgba(234,88,12,0.3)" : "#e2e8f0"}`,
                borderRight: `3px solid ${STATUS_DOT[effectiveStatus]}`,
                padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 10,
                marginBottom: 8,
                opacity: rowOpacity * (completed ? 0.55 : 1),
              }}>
                {/* Checkbox */}
                {checkboxVisible && (
                  <div style={{
                    width: 16, height: 16, borderRadius: 4,
                    border: `2px solid ${checked ? ORANGE : "#cbd5e1"}`,
                    background: checked ? ORANGE : "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    opacity: interpolate(frame, [SELECT_MODE_ON, SELECT_MODE_ON + 10], [0, 1], { extrapolateRight: "clamp" }),
                  }}>
                    {checked && <span style={{ color: "white", fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                )}

                {/* Status */}
                <div style={{
                  background: effectiveStatus === "overdue" ? "#fef2f2" : effectiveStatus === "active" ? "#f0fdf4" : "#f8fafc",
                  color: effectiveStatus === "overdue" ? "#dc2626" : effectiveStatus === "active" ? "#16a34a" : "#64748b",
                  borderRadius: 99, padding: "3px 9px", fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>
                  {STATUS_LABEL[effectiveStatus]}
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", flex: 1, textDecoration: completed ? "line-through" : "none" }}>
                  {task.title}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: PRIORITY_COLOR[task.priority] }} />
                  <span style={{ fontSize: 10, color: PRIORITY_COLOR[task.priority], fontWeight: 600 }}>{task.priority}</span>
                </div>

                <div style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>{task.due}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Postpone dialog */}
      {dialogOpacity > 0.01 && (
        <div style={{
          position: "absolute", inset: 0,
          background: `rgba(15,23,42,${dialogOpacity * 0.4})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 80,
        }}>
          <div style={{
            background: "white", borderRadius: 16,
            padding: "24px 28px", width: 380,
            transform: `scale(${dialogScale})`,
            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            direction: "rtl",
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>דחיית משימות</div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 18 }}>בחר תאריך חדש עבור 2 המשימות הנבחרות</div>
            <div style={{
              border: "2px solid #3b82f6", borderRadius: 10, padding: "11px 14px",
              marginBottom: 18, background: "#eff6ff",
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6" }}>11.04.2026 (מחר)</span>
            </div>
            <div style={{
              background: "#3b82f6", color: "white",
              borderRadius: 10, padding: "11px",
              textAlign: "center", fontSize: 14, fontWeight: 800,
            }}>
              אשר דחייה
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
