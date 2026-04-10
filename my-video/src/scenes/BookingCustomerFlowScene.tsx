// src/scenes/BookingCustomerFlowScene.tsx
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CursorOverlay, CursorWaypoint } from "./CursorOverlay";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";

// Timeline (18s = 540 frames)
// 0-70:  service cards visible, cursor selects "טיפול ורחצה"
// 70-200: calendar fades in, cursor selects date
// 200-360: time slots visible, cursor clicks "11:00"
// 360-540: hold selected state

const CARD_CLICK    = 70;   // "טיפול ורחצה" selected
const CAL_VISIBLE   = 80;   // calendar section fades in
const DATE_CLICK    = 190;  // date selected
const SLOTS_VISIBLE = 210;  // time slots fade in
const SLOT_CLICK    = 290;  // "11:00" selected

const CURSOR_WAYPOINTS: CursorWaypoint[] = [
  { frame: 0,          x: 640,  y: 360 },
  { frame: 50,         x: 400,  y: 300 },
  { frame: CARD_CLICK, x: 280,  y: 280, action: "click" },
  { frame: 100,        x: 640,  y: 420 },
  { frame: DATE_CLICK, x: 700,  y: 440, action: "click" },
  { frame: 230,        x: 400,  y: 560 },
  { frame: SLOT_CLICK, x: 340,  y: 560, action: "click" },
];

const SERVICES = [
  { name: "טיפול ורחצה",  price: "₪150", duration: "45 דקות", icon: "✂️" },
  { name: "פנסיון יומי",  price: "₪120", duration: "ביום",    icon: "🏠" },
  { name: "אילוף פרטי",   price: "₪250", duration: "60 דקות", icon: "🐾" },
  { name: "הליכה",        price: "₪80",  duration: "30 דקות", icon: "🦮" },
];

const CALENDAR_DAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const AVAILABLE_DATES = [5, 6, 7, 11, 12, 13, 14, 18, 19, 20, 21, 25, 26, 27, 28];
const SELECTED_DATE = 11;
const CAL_DATES: (number | null)[] = [
  null, null, null, null, 1, 2, 3,
  4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17,
  18, 19, 20, 21, 22, 23, 24,
  25, 26, 27, 28, 29, 30, 31,
];

const TIME_SLOTS = ["09:00", "10:00", "11:00", "14:00", "16:00"];
const BUSY_SLOTS = ["10:00"];

export const BookingCustomerFlowScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  const serviceSelected = frame >= CARD_CLICK;
  const dateSelected = frame >= DATE_CLICK;
  const slotSelected = frame >= SLOT_CLICK;

  const calOpacity = interpolate(frame, [CAL_VISIBLE, CAL_VISIBLE + 20], [0, 1], { extrapolateRight: "clamp" });
  const slotsOpacity = interpolate(frame, [SLOTS_VISIBLE, SLOTS_VISIBLE + 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: "white",
      fontFamily: FONT,
      direction: "rtl",
      opacity,
    }}>
      {/* Orange top border */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: ORANGE }} />

      {/* Header */}
      <div style={{
        position: "absolute", top: 4, left: 0, right: 0, height: 56,
        background: "white", borderBottom: "1px solid #e2e8f0",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>פנסיון כלבים שמח</span>
        <span style={{ fontSize: 12, color: "#64748b", background: "#f1f5f9", borderRadius: 6, padding: "3px 10px" }}>מופעל ע״י Petra</span>
      </div>

      {/* Step indicator */}
      <div style={{
        position: "absolute", top: 60, left: 0, right: 0, height: 44,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        borderBottom: "1px solid #f1f5f9",
      }}>
        {[1, 2, 3].map((step) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: step === 1 ? ORANGE : "#e2e8f0",
              color: step === 1 ? "white" : "#94a3b8",
              fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>{step}</div>
            {step < 3 && <div style={{ width: 40, height: 2, background: "#e2e8f0" }} />}
          </div>
        ))}
        <span style={{ fontSize: 12, color: "#64748b", marginRight: 8 }}>שלב 1 מתוך 3</span>
      </div>

      {/* Main content */}
      <div style={{ position: "absolute", top: 104, left: 0, right: 0, bottom: 0, overflowY: "hidden", padding: "20px 80px" }}>

        {/* Service cards */}
        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>בחר שירות</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          {SERVICES.map((svc, i) => {
            const isSelected = serviceSelected && svc.name === "טיפול ורחצה";
            const cardP = spring({ frame: frame - 10 - i * 8, fps, config: { damping: 200 } });
            const cardOpacity = interpolate(frame, [10 + i * 8, 22 + i * 8], [0, 1], { extrapolateRight: "clamp" });
            const cardY = interpolate(cardP, [0, 1], [12, 0]);
            return (
              <div key={svc.name} style={{
                background: isSelected ? "rgba(234,88,12,0.06)" : "white",
                border: `2px solid ${isSelected ? ORANGE : "#e2e8f0"}`,
                borderRadius: 12, padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 12,
                opacity: cardOpacity, transform: `translateY(${cardY}px)`,
                cursor: "pointer",
              }}>
                <span style={{ fontSize: 28 }}>{svc.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{svc.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{svc.duration} · {svc.price}</div>
                </div>
                {isSelected && (
                  <div style={{ marginRight: "auto", color: ORANGE, fontSize: 18, fontWeight: 800 }}>✓</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Calendar */}
        <div style={{ opacity: calOpacity }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>בחר תאריך — מאי 2026</div>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, background: "#fafafa", display: "inline-block", marginBottom: 20 }}>
            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 36px)", gap: 4, marginBottom: 8 }}>
              {CALENDAR_DAYS.map((d) => (
                <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{d}</div>
              ))}
            </div>
            {/* Date grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 36px)", gap: 4 }}>
              {CAL_DATES.map((date, i) => {
                if (!date) return <div key={i} />;
                const isAvail = AVAILABLE_DATES.includes(date);
                const isSel = dateSelected && date === SELECTED_DATE;
                return (
                  <div key={i} style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: isSel ? ORANGE : isAvail ? "rgba(234,88,12,0.1)" : "transparent",
                    color: isSel ? "white" : isAvail ? ORANGE : "#cbd5e1",
                    fontSize: 12, fontWeight: isSel || isAvail ? 700 : 400,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: isAvail ? "pointer" : "default",
                  }}>
                    {date}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Time slots */}
        <div style={{ opacity: slotsOpacity }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>בחר שעה</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {TIME_SLOTS.map((slot) => {
              const isBusy = BUSY_SLOTS.includes(slot);
              const isSel = slotSelected && slot === "11:00";
              return (
                <div key={slot} style={{
                  padding: "10px 20px", borderRadius: 10,
                  border: `2px solid ${isSel ? ORANGE : "#e2e8f0"}`,
                  background: isSel ? ORANGE : isBusy ? "#f8fafc" : "white",
                  color: isSel ? "white" : isBusy ? "#cbd5e1" : "#0f172a",
                  fontSize: 14, fontWeight: 700,
                  textDecoration: isBusy ? "line-through" : "none",
                  cursor: isBusy ? "default" : "pointer",
                }}>
                  {slot}
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
