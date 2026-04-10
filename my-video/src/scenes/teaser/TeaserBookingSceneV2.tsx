// src/scenes/teaser/TeaserBookingSceneV2.tsx
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TeaserPainPhase } from "../../components/teaser/TeaserPainPhase";
import { BenefitTag } from "../../components/teaser/BenefitTag";
import { CursorAnimation } from "../../components/teaser/CursorAnimation";
import { HighlightBox } from "../HighlightBox";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const BRAND = "#f97316";
const PAIN_FRAMES = 120;

const CLICK_SERVICE_UFRAME = 100;
const PHASE2_START_UFRAME = 108;
const CLICK_SLOT_UFRAME = 160;
const CHECK_UFRAME = 168;

const SERVICES = [
  { label: "טיפוח מלא", duration: "90 דקות", price: "₪180", color: "#ea580c", colorBg: "rgba(234,88,12,0.10)", delay: 16 },
  { label: "אמבטיה ותספורת", duration: "60 דקות", price: "₪140", color: "#3b82f6", colorBg: "rgba(59,130,246,0.10)", delay: 24 },
  { label: "קיצוץ ציפורניים", duration: "20 דקות", price: "₪50", color: "#8b5cf6", colorBg: "rgba(139,92,246,0.10)", delay: 32 },
];

const SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];
const SELECTED_SLOT = 3;

export const TeaserBookingSceneV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const uiFrame = Math.max(0, frame - PAIN_FRAMES);
  const painVisible = frame <= 120;

  const uiOpacity = interpolate(frame, [112, 128], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headerOpacity = interpolate(uiFrame, [4, 18], [0, 1], { extrapolateRight: "clamp" });

  const phase1Opacity = interpolate(uiFrame, [CLICK_SERVICE_UFRAME, CLICK_SERVICE_UFRAME + 10], [1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const phase2Opacity = interpolate(uiFrame, [PHASE2_START_UFRAME, PHASE2_START_UFRAME + 10], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  const serviceSelectP = interpolate(uiFrame, [CLICK_SERVICE_UFRAME - 4, CLICK_SERVICE_UFRAME + 6], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const isServiceSelected = serviceSelectP > 0.5;

  const progressBarWidth = interpolate(
    uiFrame,
    [PHASE2_START_UFRAME, PHASE2_START_UFRAME + 12],
    [33, 66],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const showPhase2Label = phase2Opacity > 0.5;

  const zoomP = spring({ frame: uiFrame - 6, fps, config: { damping: 320, stiffness: 45 } });
  const zoomScale = interpolate(zoomP, [0, 1], [1.0, 1.10]);

  const btnScale = interpolate(
    uiFrame,
    [CLICK_SLOT_UFRAME, CLICK_SLOT_UFRAME + 4, CLICK_SLOT_UFRAME + 10],
    [1, 0.95, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const checkOpacity = interpolate(uiFrame, [CHECK_UFRAME, CHECK_UFRAME + 10], [0, 1], { extrapolateRight: "clamp" });
  const checkScale = spring({ frame: uiFrame - CHECK_UFRAME, fps, config: { damping: 160, stiffness: 280 } });
  const checkCircleScale = spring({ frame: uiFrame - CHECK_UFRAME - 4, fps, config: { damping: 200, stiffness: 180 } });

  return (
    <AbsoluteFill style={{ background: "#f8fafc", fontFamily: FONT, direction: "rtl" }}>

      <div style={{ position: "absolute", inset: 0, opacity: uiOpacity }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden" }}>
          <div style={{ transform: `scale(${zoomScale})`, transformOrigin: "50% 44%", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>

            <div style={{
              width: "100%", background: "white",
              borderBottom: "1px solid #e2e8f0",
              padding: "0 32px", height: 52,
              display: "flex", alignItems: "center", gap: 10,
              opacity: headerOpacity, flexShrink: 0,
            }}>
              <Img src={staticFile("petra-icon.png")} style={{ width: 26, height: 26 }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>מרכז טיפוח הכלב המאושר</span>
            </div>

            <div style={{
              width: "100%", background: "white",
              borderBottom: "1px solid #f1f5f9",
              padding: "8px 32px 0", opacity: headerOpacity, flexShrink: 0,
            }}>
              <div style={{ height: 5, background: "#e2e8f0", borderRadius: 99, overflow: "hidden", marginBottom: 5 }}>
                <div style={{ height: "100%", width: `${progressBarWidth}%`, background: BRAND, borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, paddingBottom: 7 }}>
                {showPhase2Label ? "שלב 2 מתוך 3: בחר מועד" : "שלב 1 מתוך 3: בחר שירות"}
              </div>
            </div>

            <div style={{ width: 520, marginTop: 14, position: "relative", height: 400 }}>

              {/* Phase 1: service selection */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, opacity: phase1Opacity }}>
                <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: "18px 22px" }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 12 }}>בחר שירות</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {SERVICES.map((svc, i) => {
                      const p = spring({ frame: uiFrame - svc.delay, fps, config: { damping: 200 } });
                      const y = interpolate(p, [0, 1], [10, 0]);
                      const svcOpacity = interpolate(uiFrame, [svc.delay, svc.delay + 10], [0, 1], { extrapolateRight: "clamp" });
                      const selected = i === 0 && isServiceSelected;

                      return (
                        <div key={svc.label} style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "11px 14px", borderRadius: 12,
                          border: `2px solid ${selected ? "#FDBA74" : "#e2e8f0"}`,
                          background: selected ? "#FFF7ED" : "white",
                          boxShadow: selected ? "0 0 0 1px #fed7aa" : "none",
                          opacity: svcOpacity, transform: `translateY(${y}px)`,
                        }}>
                          <div style={{
                            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                            background: selected ? "rgba(234,88,12,0.12)" : svc.colorBg,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <div style={{ width: 18, height: 18, borderRadius: "50%", background: selected ? ORANGE : svc.color }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{svc.label}</div>
                            <div style={{ marginTop: 3 }}>
                              <span style={{ fontSize: 10, fontWeight: 600, background: "#f1f5f9", color: "#64748b", borderRadius: 4, padding: "1px 6px" }}>{svc.duration}</span>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: selected ? ORANGE : "#0f172a" }}>{svc.price}</span>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M5 3.5L9 7L5 10.5" stroke={selected ? ORANGE : "#94a3b8"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Phase 2: time slot + confirm */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, opacity: phase2Opacity }}>
                <div style={{
                  background: "#FFF7ED", borderRadius: 12, border: "1px solid #FED7AA",
                  padding: "9px 16px", marginBottom: 10,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  opacity: interpolate(uiFrame, [PHASE2_START_UFRAME, PHASE2_START_UFRAME + 12], [0, 1], { extrapolateRight: "clamp" }),
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: ORANGE }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>טיפוח מלא</span>
                    <span style={{ fontSize: 10, fontWeight: 600, background: "#f1f5f9", color: "#64748b", borderRadius: 4, padding: "1px 6px" }}>90 דקות</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: ORANGE }}>₪180</span>
                </div>

                <div style={{
                  background: "white", borderRadius: 16, border: "1px solid #e2e8f0", padding: "18px 22px",
                  opacity: interpolate(uiFrame, [PHASE2_START_UFRAME + 2, PHASE2_START_UFRAME + 14], [0, 1], { extrapolateRight: "clamp" }),
                }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", marginBottom: 2 }}>בחר שעה</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 14 }}>יום שני, 7 באפריל</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                    {SLOTS.map((slot, i) => {
                      const slotDelay = PHASE2_START_UFRAME + 10 + i * 6;
                      const slotOpacity = interpolate(uiFrame, [slotDelay, slotDelay + 8], [0, 1], { extrapolateRight: "clamp" });
                      const slotP = spring({ frame: uiFrame - slotDelay, fps, config: { damping: 200 } });
                      const slotY = interpolate(slotP, [0, 1], [8, 0]);
                      const isSelected = i === SELECTED_SLOT && uiFrame >= CLICK_SLOT_UFRAME - 2;

                      return (
                        <div key={slot} style={{
                          padding: "11px 8px", borderRadius: 10, textAlign: "center",
                          fontSize: 14, fontWeight: 700,
                          border: `2px solid ${isSelected ? BRAND : "#e2e8f0"}`,
                          background: isSelected ? BRAND : "white",
                          color: isSelected ? "white" : "#475569",
                          boxShadow: isSelected ? "0 4px 14px rgba(249,115,22,0.35)" : "none",
                          opacity: slotOpacity, transform: `translateY(${slotY}px)`,
                        }}>
                          {slot}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{
                  marginTop: 12, background: ORANGE, borderRadius: 12,
                  padding: "13px", textAlign: "center",
                  fontSize: 15, fontWeight: 800, color: "white",
                  transform: `scale(${btnScale})`,
                  boxShadow: "0 4px 20px rgba(234,88,12,0.4)",
                  opacity: interpolate(uiFrame, [PHASE2_START_UFRAME + 22, PHASE2_START_UFRAME + 34], [0, 1], { extrapolateRight: "clamp" }),
                }}>
                  אשר הזמנה
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Checkmark overlay */}
        {checkOpacity > 0.02 && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `rgba(8,12,20,${checkOpacity * 0.55})`,
            zIndex: 85,
          }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: checkOpacity, transform: `scale(${checkScale})` }}>
              <div style={{
                width: 88, height: 88, borderRadius: "50%",
                background: "#dcfce7", border: "3px solid #86efac",
                display: "flex", alignItems: "center", justifyContent: "center",
                transform: `scale(${checkCircleScale})`,
                boxShadow: "0 0 32px rgba(34,197,94,0.4)",
              }}>
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                  <path d="M10 22 L18 32 L34 14" stroke="#16a34a" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "white", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>ההזמנה אושרה!</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>אישור נשלח ב-WhatsApp ✓</div>
            </div>
          </div>
        )}

        {/* Cursor 1: moves to first service, clicks */}
        <div style={{ opacity: phase1Opacity }}>
          <CursorAnimation
            startX={780} startY={200}
            endX={620} endY={332}
            appearAt={150}
            clickAt={PAIN_FRAMES + CLICK_SERVICE_UFRAME}
          />
        </div>

        {/* Cursor 2: moves to 10:30 slot, clicks */}
        <div style={{ opacity: phase2Opacity }}>
          <CursorAnimation
            startX={560} startY={300}
            endX={486} endY={508}
            appearAt={PAIN_FRAMES + PHASE2_START_UFRAME + 6}
            clickAt={PAIN_FRAMES + CLICK_SLOT_UFRAME}
          />
        </div>

        <BenefitTag text="הלקוח מזמין לבד — 24/7" appearAt={298} />
      </div>

      {/* HighlightBox: confirm button area — adjust after preview */}
      <HighlightBox x={370} y={390} width={540} height={65} startFrame={450} endFrame={555} borderRadius={12} />

      {painVisible && (
        <TeaserPainPhase
          mainText="הלקוח התקשר. היית עסוק."
          subText="הוא הזמין אצל המתחרה"
          subTextColor="#ef4444"
        />
      )}
    </AbsoluteFill>
  );
};
