// src/scenes/TasksOverviewScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PetraSidebar } from "./PetraSidebar";
import { CursorOverlay, CursorWaypoint } from "./CursorOverlay";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const SIDEBAR_W = 210;

const CATEGORY_TABS = ["כל", "כללי", "פנסיון", "האכלה", "תרופות", "לידים", "בריאות"];

// Audio: ~19s = 570f @ 30fps. Silence analysis: "כללי,פנסיון,תרופות" section starts at frame 384.
// Approx: פנסיון spoken ~frame 400, תרופות ~frame 420, back to כל at ~440.
// Tab switching: כל(0-400) → פנסיון(400-420) → תרופות(420-440) → כל(440+)
function getActiveTab(frame: number): string {
  if (frame < 400) return "כל";
  if (frame < 420) return "פנסיון";
  if (frame < 440) return "תרופות";
  return "כל";
}

// RTL canvas layout: sidebar right (x=1070-1280), content left (x=0-1070).
// Zoom 1.06, origin (535,302). Tab y≈53 on canvas.
// Tab centers (canvas): כל≈1051, פנסיון≈923, תרופות≈766.
const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,   x: 600, y: 300 },
  { frame: 392, x: 923, y: 53  },
  { frame: 400, x: 923, y: 53, action: "click" },
  { frame: 413, x: 766, y: 53  },
  { frame: 420, x: 766, y: 53, action: "click" },
  { frame: 433, x: 1051, y: 53 },
  { frame: 440, x: 1051, y: 53, action: "click" },
];

const STATUS_STYLE = {
  overdue:   { bg: "#fef2f2", text: "#dc2626", dot: "#ef4444", label: "באיחור" },
  active:    { bg: "#f0fdf4", text: "#16a34a", dot: "#22c55e", label: "עכשיו" },
  scheduled: { bg: "#f8fafc", text: "#64748b", dot: "#94a3b8", label: "מתוכנן" },
  done:      { bg: "#f0fdf4", text: "#16a34a", dot: "#bbf7d0", label: "הושלם" },
} as const;

const PRIORITY_COLOR: Record<string, string> = {
  "דחופה": "#ef4444", "גבוהה": "#ea580c", "בינונית": "#3b82f6", "נמוכה": "#94a3b8",
};
const CAT_COLOR: Record<string, string> = {
  "תרופות": "#8b5cf6", "האכלה": "#f59e0b", "פנסיון": "#3b82f6", "כללי": "#64748b", "בריאות": "#22c55e",
};

const ALL_TASKS = [
  { title: "מתן תרופה לנובה",     cat: "תרופות", priority: "דחופה",  due: "היום 18:00",  status: "overdue"   as const, rowDelay: 22 },
  { title: "האכלה — חדר 3",        cat: "האכלה",  priority: "גבוהה",  due: "עכשיו",       status: "active"    as const, rowDelay: 34 },
  { title: "צ׳ק-אאוט — מקס",       cat: "פנסיון", priority: "בינונית",due: "מחר 10:00",  status: "scheduled" as const, rowDelay: 46 },
  { title: "שיחה עם ענבל כהן",    cat: "כללי",   priority: "נמוכה",  due: "אתמול",       status: "done"      as const, rowDelay: 58 },
  { title: "בדיקת חיסון — קיירה", cat: "בריאות", priority: "גבוהה",  due: "מחרתיים",     status: "scheduled" as const, rowDelay: 70 },
];

// Filter tasks by active tab (simulates real filter behavior)
function getVisibleTasks(tab: string, frame: number) {
  // During tab switch (150-175 for פנסיון, 310-335 for תרופות), fade out and show subset
  if (tab === "פנסיון") return ALL_TASKS.filter((t) => t.cat === "פנסיון");
  if (tab === "תרופות") return ALL_TASKS.filter((t) => t.cat === "תרופות");
  return ALL_TASKS;
}

export const TasksOverviewScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.5, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: "clamp" });

  const activeTab = getActiveTab(frame);
  const visibleTasks = getVisibleTasks(activeTab, frame);

  // Content cross-fade on tab switch (synced to audio analysis)
  const contentOpacity = interpolate(
    frame,
    [398, 404, 408, 418, 424, 428, 438, 444, 448],
    [1,   0,   1,   1,   0,   1,   1,   0,   1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const zoomP = spring({ frame: frame - 8, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.06]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl", opacity }}>
      {/* Sidebar */}
      <PetraSidebar width={SIDEBAR_W} activeLabel="ניהול משימות" />

      {/* Main content */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "50% 42%", width: "100%", height: "100%" }}>

          {/* Header */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            padding: "0 24px", height: 52,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            opacity: headerOpacity, flexShrink: 0,
          }}>
            <div style={{
              background: ORANGE, color: "white",
              borderRadius: 8, padding: "6px 14px",
              fontSize: 12, fontWeight: 700,
            }}>
              + משימה חדשה
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>משימות</div>
          </div>

          {/* Category tabs */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            display: "flex", padding: "0 24px", opacity: headerOpacity,
          }}>
            {CATEGORY_TABS.map((tab) => {
              const isActive = tab === activeTab;
              return (
                <div key={tab} style={{
                  padding: "10px 12px 8px",
                  fontSize: 12, fontWeight: isActive ? 700 : 500,
                  color: isActive ? ORANGE : "#64748b",
                  borderBottom: isActive ? `2px solid ${ORANGE}` : "2px solid transparent",
                  whiteSpace: "nowrap",
                }}>
                  {tab}
                </div>
              );
            })}
          </div>

          {/* Task list */}
          <div style={{ padding: "16px 24px", opacity: contentOpacity }}>
            {visibleTasks.map((task, i) => {
              const st = STATUS_STYLE[task.status];
              const rowOpacity = interpolate(frame, [task.rowDelay, task.rowDelay + 12], [0, 1], { extrapolateRight: "clamp" });
              const rowP = spring({ frame: frame - task.rowDelay, fps, config: { damping: 200 } });
              const rowY = interpolate(rowP, [0, 1], [10, 0]);
              const isDone = task.status === "done";

              return (
                <div key={task.title} style={{
                  background: "white", borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  borderRight: `3px solid ${st.dot}`,
                  padding: "11px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                  marginBottom: 8,
                  opacity: rowOpacity * (isDone ? 0.55 : 1),
                  transform: `translateY(${rowY}px)`,
                }}>
                  {/* Status badge */}
                  <div style={{
                    background: st.bg, color: st.text,
                    borderRadius: 99, padding: "3px 9px",
                    fontSize: 10, fontWeight: 700, flexShrink: 0,
                  }}>
                    {st.label}
                  </div>

                  {/* Title */}
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: "#0f172a", flex: 1,
                    textDecoration: isDone ? "line-through" : "none",
                  }}>
                    {task.title}
                  </div>

                  {/* Category */}
                  <div style={{
                    fontSize: 10, fontWeight: 600,
                    color: CAT_COLOR[task.cat] ?? "#64748b",
                    background: `${CAT_COLOR[task.cat] ?? "#64748b"}18`,
                    borderRadius: 4, padding: "2px 7px", flexShrink: 0,
                  }}>
                    {task.cat}
                  </div>

                  {/* Priority dot */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: PRIORITY_COLOR[task.priority] }} />
                    <span style={{ fontSize: 10, color: PRIORITY_COLOR[task.priority], fontWeight: 600 }}>{task.priority}</span>
                  </div>

                  {/* Due date */}
                  <div style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>{task.due}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <CursorOverlay waypoints={CURSOR_WAYPOINTS} />
    </AbsoluteFill>
  );
};
