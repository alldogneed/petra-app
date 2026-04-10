// src/scenes/TasksFiltersScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { HighlightBox } from "./HighlightBox";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

// Timeline
const SEARCH_START  = 20;  // search bar highlighted, text appears
const FILTER_START  = 145; // status filter "באיחור" activates
const DATE_START    = 270; // date filter "היום" activates

// Typewriter: "תרופה" typed character by character
const SEARCH_TEXT = "תרופה";
function getTypedText(frame: number): string {
  if (frame < SEARCH_START) return "";
  const charsTyped = Math.min(
    SEARCH_TEXT.length,
    Math.floor((frame - SEARCH_START) / 8)
  );
  return SEARCH_TEXT.slice(0, charsTyped);
}

const ALL_TASKS = [
  { title: "מתן תרופה לנובה",     cat: "תרופות", priority: "דחופה",  due: "היום 18:00",  status: "overdue"   as const },
  { title: "האכלה — חדר 3",        cat: "האכלה",  priority: "גבוהה",  due: "עכשיו",       status: "active"    as const },
  { title: "צ׳ק-אאוט — מקס",       cat: "פנסיון", priority: "בינונית",due: "מחר 10:00",  status: "scheduled" as const },
  { title: "שיחה עם ענבל כהן",    cat: "כללי",   priority: "נמוכה",  due: "אתמול",       status: "done"      as const },
  { title: "בדיקת חיסון — קיירה", cat: "בריאות", priority: "גבוהה",  due: "מחרתיים",     status: "scheduled" as const },
];

const STATUS_DOT: Record<string, string> = {
  overdue: "#ef4444", active: "#22c55e", scheduled: "#94a3b8", done: "#bbf7d0",
};
const STATUS_LABEL: Record<string, string> = {
  overdue: "באיחור", active: "עכשיו", scheduled: "מתוכנן", done: "הושלם",
};
const PRIORITY_COLOR: Record<string, string> = {
  "דחופה": "#ef4444", "גבוהה": "#ea580c", "בינונית": "#3b82f6", "נמוכה": "#94a3b8",
};

export const TasksFiltersScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [4, 16], [0, 1], { extrapolateRight: "clamp" });
  const typedText = getTypedText(frame);

  // Filter state
  const searchActive = frame >= SEARCH_START && typedText.length > 0;
  const statusFilterActive = frame >= FILTER_START;
  const dateFilterActive = frame >= DATE_START;

  // Visible tasks based on active filters
  let visibleTasks = ALL_TASKS;
  if (searchActive && typedText === SEARCH_TEXT) {
    visibleTasks = ALL_TASKS.filter((t) => t.title.includes("תרופה"));
  } else if (searchActive) {
    // partial search — show all with opacity changes
    visibleTasks = ALL_TASKS;
  }
  if (statusFilterActive) {
    visibleTasks = visibleTasks.filter((t) => t.status === "overdue");
  }

  const listOpacity = interpolate(frame, [75, 88], [1, 0.3, ], { extrapolateRight: "clamp" })
    * interpolate(frame, [88, 100], [0.3, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const zoomP = spring({ frame: frame - 6, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.05]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול משימות" />

      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "50% 38%", width: "100%", height: "100%" }}>

          {/* Header */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            padding: "0 24px", height: 52,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            opacity: headerOpacity,
          }}>
            <div style={{ background: ORANGE, color: "white", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700 }}>+ משימה חדשה</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>משימות</div>
          </div>

          {/* Filters toolbar */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            padding: "10px 24px", display: "flex", alignItems: "center", gap: 10,
            opacity: headerOpacity,
          }}>
            {/* Search field */}
            <div style={{
              flex: 1, border: `1.5px solid ${frame >= SEARCH_START && frame < FILTER_START ? ORANGE : "#e2e8f0"}`,
              borderRadius: 8, padding: "7px 12px",
              display: "flex", alignItems: "center", gap: 6,
              background: "white",
              boxShadow: frame >= SEARCH_START && frame < FILTER_START ? "0 0 0 2px rgba(234,88,12,0.1)" : "none",
            }}>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>🔍</span>
              <span style={{ fontSize: 13, color: typedText ? "#0f172a" : "#94a3b8", fontWeight: typedText ? 600 : 400 }}>
                {typedText || "חיפוש משימה..."}
              </span>
            </div>

            {/* Status filter buttons */}
            {["הכל", "באיחור", "עכשיו", "מתוכנן"].map((s) => {
              const isActive = s === "באיחור" && statusFilterActive;
              return (
                <div key={s} style={{
                  padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
                  background: isActive ? ORANGE : "white",
                  color: isActive ? "white" : "#64748b",
                  border: `1.5px solid ${isActive ? ORANGE : "#e2e8f0"}`,
                  flexShrink: 0,
                }}>
                  {s}
                </div>
              );
            })}

            {/* Date filter */}
            <div style={{
              padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700,
              background: dateFilterActive ? "#eff6ff" : "white",
              color: dateFilterActive ? "#3b82f6" : "#64748b",
              border: `1.5px solid ${dateFilterActive ? "#3b82f6" : "#e2e8f0"}`,
              flexShrink: 0,
            }}>
              {dateFilterActive ? "היום" : "כל תאריך"}
            </div>
          </div>

          {/* Task list */}
          <div style={{ padding: "14px 24px", opacity: listOpacity }}>
            {visibleTasks.map((task, i) => {
              const rowOpacity = interpolate(frame, [12 + i * 10, 24 + i * 10], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={task.title} style={{
                  background: "white", borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  borderRight: `3px solid ${STATUS_DOT[task.status]}`,
                  padding: "10px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                  marginBottom: 8,
                  opacity: rowOpacity * (task.status === "done" ? 0.55 : 1),
                }}>
                  <div style={{
                    background: task.status === "overdue" ? "#fef2f2" : task.status === "active" ? "#f0fdf4" : "#f8fafc",
                    color: task.status === "overdue" ? "#dc2626" : task.status === "active" ? "#16a34a" : "#64748b",
                    borderRadius: 99, padding: "3px 9px", fontSize: 10, fontWeight: 700, flexShrink: 0,
                  }}>
                    {STATUS_LABEL[task.status]}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", flex: 1, textDecoration: task.status === "done" ? "line-through" : "none" }}>
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
      </div>

      {/* Highlight search bar while typing */}
      <HighlightBox x={220} y={60} width={340} height={36} startFrame={SEARCH_START} endFrame={FILTER_START - 10} borderRadius={8} />
      {/* Highlight status filter area */}
      <HighlightBox x={572} y={60} width={252} height={36} startFrame={FILTER_START} endFrame={DATE_START - 10} borderRadius={7} />
    </AbsoluteFill>
  );
};
