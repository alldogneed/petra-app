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

const STAGES = [
  { id: "new", label: "ליד חדש", color: "#ef4444", bg: "#fef2f2", count: 3, delay: 15 },
  { id: "no-answer", label: "ללא מענה", color: "#f59e0b", bg: "#fffbeb", count: 2, delay: 28 },
  { id: "contacted", label: "נוצר קשר ראשוני", color: "#3b82f6", bg: "#eff6ff", count: 4, delay: 41 },
  { id: "matched", label: "תואם בבית הלקוח", color: "#22c55e", bg: "#f0fdf4", count: 2, delay: 54 },
];

const CARDS: {
  stage: string;
  name: string;
  dog: string;
  phone: string;
  source: string;
  service: string;
  date: string;
  stageColor: string;
  overdue: boolean;
  delay: number;
}[] = [
  { stage: "new", name: "ענבל כהן", dog: "קיירה", phone: "054-321-8876", source: "אתר", service: "אילוף גורים", date: "7.4", stageColor: "#ef4444", overdue: false, delay: 75 },
  { stage: "new", name: "מיכל אברהם", dog: "באלו", phone: "052-445-6632", source: "גוגל", service: "חרדת נטישה", date: "6.4", stageColor: "#ef4444", overdue: true, delay: 88 },
  { stage: "new", name: "יוסי גולן", dog: "רוקי", phone: "050-887-2341", source: "ידני", service: "שיעור הגנה", date: "5.4", stageColor: "#ef4444", overdue: true, delay: 100 },
  { stage: "no-answer", name: "אורלי מזרחי", dog: "נובה", phone: "052-540-9453", source: "ידני", service: "חרדת נטישה", date: "4.4", stageColor: "#f59e0b", overdue: true, delay: 112 },
  { stage: "no-answer", name: "איתי שמש", dog: "מקס", phone: "053-201-7654", source: "אתר", service: "אילוף גורים", date: "3.4", stageColor: "#f59e0b", overdue: true, delay: 124 },
  { stage: "contacted", name: "עמית שפירא", dog: "לונה", phone: "052-877-5474", source: "ידני", service: "אילוף גורים", date: "9.4", stageColor: "#3b82f6", overdue: false, delay: 136 },
  { stage: "contacted", name: "נמרוד בן-דוד", dog: "קסאנו", phone: "054-941-2315", source: "אתר", service: "שיעור הגנה", date: "10.4", stageColor: "#3b82f6", overdue: false, delay: 148 },
  { stage: "matched", name: "שירה אברמוב", dog: "לילה", phone: "044-638-855", source: "אתר", service: "אילוף גורים", date: "8.4", stageColor: "#22c55e", overdue: false, delay: 160 },
  { stage: "matched", name: "לואי מנסור", dog: "בוני", phone: "050-580-9381", source: "אתר", service: "שיעור הגנה", date: "11.4", stageColor: "#22c55e", overdue: false, delay: 172 },
];

const SOURCE_STYLE: Record<string, { bg: string; text: string }> = {
  אתר: { bg: "#dbeafe", text: "#1d4ed8" },
  גוגל: { bg: "#dcfce7", text: "#15803d" },
  ידני: { bg: "#f1f5f9", text: "#475569" },
};

const LeadCard: React.FC<{
  name: string;
  dog: string;
  phone: string;
  source: string;
  service: string;
  date: string;
  stageColor: string;
  overdue: boolean;
  delay: number;
  frame: number;
  fps: number;
}> = ({ name, dog, phone, source, service, date, stageColor, overdue, delay, frame, fps }) => {
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const y = interpolate(p, [0, 1], [16, 0]);
  const cardOpacity = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });
  const src = SOURCE_STYLE[source] ?? SOURCE_STYLE["ידני"];

  return (
    <div
      style={{
        background: "white",
        borderRadius: 8,
        border: "1px solid #e8edf2",
        borderRight: `3px solid ${stageColor}`,
        padding: "10px 12px 10px 10px",
        opacity: cardOpacity,
        transform: `translateY(${y}px)`,
        direction: "rtl",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* Row 1: name + source */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{name}</span>
        <span style={{ fontSize: 9, fontWeight: 600, background: src.bg, color: src.text, borderRadius: 4, padding: "2px 6px" }}>
          {source}
        </span>
      </div>

      {/* Row 1.5: dog name */}
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>
        🐾 <span style={{ fontWeight: 600 }}>{dog}</span>
      </div>

      {/* Row 2: phone */}
      <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6, direction: "ltr", textAlign: "right" }}>
        {phone}
      </div>

      {/* Row 3: service + date */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize: 9,
          fontWeight: overdue ? 700 : 500,
          color: overdue ? "#dc2626" : "#94a3b8",
          background: overdue ? "#fef2f2" : "transparent",
          borderRadius: overdue ? 4 : 0,
          padding: overdue ? "1px 5px" : "0",
        }}>
          {overdue ? "⚠️ " : "📅 "}{date}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 600,
          background: "#fff7ed", color: ORANGE,
          borderRadius: 4, padding: "2px 6px",
          border: "1px solid #fed7aa",
          maxWidth: 100, overflow: "hidden",
          whiteSpace: "nowrap", textOverflow: "ellipsis",
        }}>
          {service}
        </span>
      </div>
    </div>
  );
};

export const SalesKanbanScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.6, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const headerOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateRight: "clamp" });
  const toolbarOpacity = interpolate(frame, [12, 25], [0, 1], { extrapolateRight: "clamp" });
  const statsOpacity = interpolate(frame, [18, 35], [0, 1], { extrapolateRight: "clamp" });
  const bannerOpacity = interpolate(frame, [38, 52], [0, 1], { extrapolateRight: "clamp" });
  const bannerScale = spring({ frame: frame - 38, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar width={SIDEBAR_W} />

      {/* Content area */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, display: "flex", flexDirection: "column" }}>

        {/* Top header */}
        <div style={{
          background: "white",
          borderBottom: "1px solid #e2e8f0",
          padding: "0 24px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: headerOpacity,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>לידים</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>ניהול לקוחות פוטנציאליים</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: 8, padding: "6px 12px",
              fontSize: 11, color: "#94a3b8", width: 160,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>🔍</span> חפש ליד...
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{
          background: "white",
          borderBottom: "1px solid #f1f5f9",
          padding: "0 24px",
          height: 48,
          display: "flex",
          alignItems: "center",
          gap: 8,
          opacity: toolbarOpacity,
          flexShrink: 0,
        }}>
          <div style={{
            background: ORANGE, color: "white", borderRadius: 8,
            padding: "7px 14px", fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span>+</span> ליד חדש
          </div>
          <div style={{
            background: "white", border: "1px solid #e2e8f0",
            borderRadius: 8, padding: "7px 12px", fontSize: 12,
            color: "#475569", fontWeight: 500,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            ✏️ עריכת שלבים
          </div>
          <div style={{ flex: 1 }} />
          {[
            { label: "כל המקורות", active: true },
            { label: "אתר 5" },
            { label: "גוגל 1" },
            { label: "ידני 3" },
          ].map((chip) => (
            <div key={chip.label} style={{
              borderRadius: 99, padding: "4px 12px",
              fontSize: 11, fontWeight: 600,
              background: chip.active ? ORANGE : "#f1f5f9",
              color: chip.active ? "white" : "#64748b",
              border: chip.active ? "none" : "1px solid #e2e8f0",
            }}>
              {chip.label}
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div style={{
          padding: "10px 24px",
          display: "flex",
          gap: 10,
          opacity: statsOpacity,
          flexShrink: 0,
        }}>
          {[
            { label: "סה\"כ לידים בטיפול", value: "11", color: "#0f172a" },
            { label: "בתהליך", value: "9", color: ORANGE },
            { label: "נסגרו", value: "3", color: "#16a34a" },
            { label: "שיעור המרה", value: "25%", color: "#64748b" },
          ].map((stat, i) => {
            const statProgress = spring({ frame: frame - 18 - i * 5, fps, config: { damping: 200 } });
            const statScale = interpolate(statProgress, [0, 1], [0.9, 1]);
            return (
              <div key={stat.label} style={{
                background: "white",
                borderRadius: 10,
                padding: "10px 16px",
                flex: 1,
                border: "1px solid #e2e8f0",
                transform: `scale(${statScale})`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Urgent banner */}
        <div style={{
          padding: "0 24px 8px",
          opacity: bannerOpacity,
          transform: `scaleY(${interpolate(bannerScale, [0, 1], [0.6, 1])})`,
          transformOrigin: "top",
          flexShrink: 0,
        }}>
          <div style={{
            background: "#fef2f2",
            border: "1.5px solid #fecaca",
            borderRadius: 8,
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{ fontSize: 13 }}>🔴</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>3 לידים ממתינים למענה</span>
            <span style={{ fontSize: 11, color: "#ef4444", marginRight: "auto" }}>ענבל, מיכל ויוסי טרם קיבלו מענה</span>
          </div>
        </div>

        {/* Kanban board */}
        <div style={{
          flex: 1,
          display: "flex",
          gap: 10,
          padding: "0 24px 16px",
          overflowY: "hidden",
          alignItems: "flex-start",
        }}>
          {STAGES.map((stage) => {
            const colProgress = spring({ frame: frame - stage.delay, fps, config: { damping: 200 } });
            const colY = interpolate(colProgress, [0, 1], [20, 0]);
            const colOpacity = interpolate(frame, [stage.delay, stage.delay + 14], [0, 1], { extrapolateRight: "clamp" });
            const stageCards = CARDS.filter((c) => c.stage === stage.id);

            return (
              <div key={stage.id} style={{
                flex: 1,
                opacity: colOpacity,
                transform: `translateY(${colY}px)`,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                minWidth: 0,
              }}>
                {/* Column header */}
                <div style={{
                  background: "white",
                  borderRadius: 8,
                  padding: "8px 12px",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: stage.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {stage.label}
                  </span>
                  <span style={{
                    background: stage.bg, color: stage.color,
                    borderRadius: 99, padding: "1px 7px",
                    fontSize: 10, fontWeight: 700,
                    border: `1px solid ${stage.color}30`,
                    flexShrink: 0,
                  }}>
                    {stage.count}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {stageCards.map((card) => (
                    <LeadCard key={card.name} {...card} frame={frame} fps={fps} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
