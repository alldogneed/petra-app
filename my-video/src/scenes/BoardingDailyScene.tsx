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

type CareType = "feeding" | "medication" | "walk" | "note";

const TYPE_CONFIG: Record<CareType, { label: string; color: string; bg: string; border: string }> = {
  feeding: { label: "האכלה", color: "#ea580c", bg: "#fff7ed", border: "#fed7aa" },
  medication: { label: "תרופה", color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" },
  walk: { label: "טיול", color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  note: { label: "הערה", color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
};

const PETS: { name: string; breed: string; room: string; items: { type: CareType; time: string; note: string; done: boolean; delay: number }[] }[] = [
  {
    name: "בובו",
    breed: "לברדור",
    room: "חדר 3",
    items: [
      { type: "feeding", time: "08:00", note: "יבש, כוס וחצי", done: true, delay: 55 },
      { type: "medication", time: "12:00", note: "ריבוקסיל 50mg", done: false, delay: 70 },
      { type: "walk", time: "09:00", note: "10 דקות, חצר א׳", done: true, delay: 85 },
    ],
  },
  {
    name: "מקס",
    breed: "גרמני",
    room: "חדר 5",
    items: [
      { type: "feeding", time: "08:00", note: "רטוב, קופסה שלמה", done: true, delay: 60 },
      { type: "walk", time: "10:00", note: "15 דקות", done: false, delay: 75 },
    ],
  },
  {
    name: "לונה",
    breed: "פודל",
    room: "חדר 2",
    items: [
      { type: "feeding", time: "08:30", note: "יבש בלבד — דיאטה", done: true, delay: 65 },
      { type: "note", time: "09:30", note: "התנהגות טובה, שיחקה בחצר", done: false, delay: 80 },
    ],
  },
];

export const BoardingDailyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateRight: "clamp" });
  const sidebarBlur = interpolate(frame, [20, 38], [0, 3], { extrapolateRight: "clamp" });

  const zoomP = spring({ frame: frame - 30, fps, config: { damping: 320, stiffness: 40 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.05]);

  return (
    <AbsoluteFill style={{ background: "#f1f5f9", fontFamily: FONT, direction: "rtl" }}>
      {/* Sidebar */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: SIDEBAR_W, filter: `blur(${sidebarBlur}px)` }}>
        <PetraSidebar width={SIDEBAR_W} activeLabel="פנסיון" />
      </div>

      {/* Main content */}
      <div style={{ position: "absolute", right: SIDEBAR_W, left: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "50% 40%", width: "100%", height: "100%" }}>

          {/* Header */}
          <div style={{
            background: "white", borderBottom: "1px solid #e2e8f0",
            padding: "0 24px", height: 52,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            opacity: headerOpacity,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>לוח טיפול יומי</div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>10 באפריל 2026</div>
          </div>

          {/* Pet cards */}
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            {PETS.map((pet, pi) => {
              const petDelay = 38 + pi * 8;
              const petP = spring({ frame: frame - petDelay, fps, config: { damping: 200 } });
              const petY = interpolate(petP, [0, 1], [12, 0]);
              const petOpacity = interpolate(frame, [petDelay, petDelay + 12], [0, 1], { extrapolateRight: "clamp" });

              return (
                <div key={pet.name} style={{
                  background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
                  padding: "14px 16px", opacity: petOpacity, transform: `translateY(${petY}px)`,
                  boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
                }}>
                  {/* Pet header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: "linear-gradient(135deg, #fb923c, #ea580c)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, color: "white", fontWeight: 700, flexShrink: 0,
                    }}>
                      {pet.name[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{pet.name}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>{pet.breed} · {pet.room}</div>
                    </div>
                  </div>

                  {/* Care items */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {pet.items.map((item, ii) => {
                      const itemOpacity = interpolate(frame, [item.delay, item.delay + 12], [0, 1], { extrapolateRight: "clamp" });
                      const itemP = spring({ frame: frame - item.delay, fps, config: { damping: 200 } });
                      const itemScale = interpolate(itemP, [0, 1], [0.85, 1]);
                      const cfg = TYPE_CONFIG[item.type];
                      return (
                        <div key={ii} style={{
                          background: cfg.bg, border: `1px solid ${cfg.border}`,
                          borderRadius: 8, padding: "6px 10px",
                          opacity: itemOpacity, transform: `scale(${itemScale})`,
                          display: "flex", alignItems: "center", gap: 6,
                        }}>
                          {item.done && (
                            <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>✓</span>
                          )}
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: cfg.color }}>{cfg.label} · {item.time}</div>
                            <div style={{ fontSize: 9, color: "#64748b", maxWidth: 130 }}>{item.note}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
