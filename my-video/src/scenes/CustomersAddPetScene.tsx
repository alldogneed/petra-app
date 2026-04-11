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
const ORANGE = "#ea580c";

export const CustomersAddPetScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - fps * 0.4, durationInFrames], [1, 0], { extrapolateLeft: "clamp" });
  const opacity = Math.min(fadeIn, fadeOut);

  // Plus button highlight
  const plusHighlight = interpolate(frame, [15, 28], [0, 1], { extrapolateRight: "clamp" });
  const plusScale = interpolate(spring({ frame: frame - 15, fps, config: { damping: 200 } }), [0, 1], [1, 1.15]);

  // Backdrop + modal
  const backdropOpacity = interpolate(frame, [30, 42], [0, 1], { extrapolateRight: "clamp" });
  const modalProgress = spring({ frame: frame - 32, fps, config: { damping: 180 } });
  const modalScale = interpolate(modalProgress, [0, 1], [0.9, 1]);
  const modalOpacity = interpolate(frame, [32, 46], [0, 1], { extrapolateRight: "clamp" });

  // Field typing
  const field1Opacity = interpolate(frame, [50, 62], [0, 1], { extrapolateRight: "clamp" });
  const field2Opacity = interpolate(frame, [68, 80], [0, 1], { extrapolateRight: "clamp" });
  const field3Opacity = interpolate(frame, [85, 97], [0, 1], { extrapolateRight: "clamp" });
  const field4Opacity = interpolate(frame, [100, 112], [0, 1], { extrapolateRight: "clamp" });

  // Save + new card appears
  const saveHighlight = interpolate(frame, [120, 132], [0, 1], { extrapolateRight: "clamp" });
  const newCardOpacity = interpolate(frame, [138, 152], [0, 1], { extrapolateRight: "clamp" });
  const newCardScale = interpolate(spring({ frame: frame - 138, fps, config: { damping: 160 } }), [0, 1], [0.8, 1]);

  return (
    <AbsoluteFill style={{ background: "#f8fafc", opacity, fontFamily: FONT, direction: "rtl" }}>
      <PetraSidebar activeLabel="לקוחות" />

      <div style={{ marginRight: SIDEBAR_W, display: "flex", gap: 20, padding: "16px 24px", height: "100%", boxSizing: "border-box" }}>
        {/* Profile sidebar */}
        <div style={{ width: 210, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Customer mini card */}
          <div style={{ background: "white", borderRadius: 12, padding: "16px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #ea580c, #c2410c)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "white", fontWeight: 800 }}>ד</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>דנה לוי</div>
                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>VIP</div>
              </div>
            </div>
          </div>

          {/* Pets section */}
          <div style={{ background: "white", borderRadius: 12, padding: "16px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>חיות מחמד</span>
              {/* Plus button */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: plusHighlight > 0.5 ? ORANGE : "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  color: plusHighlight > 0.5 ? "white" : "#475569",
                  cursor: "pointer",
                  transform: `scale(${plusScale})`,
                  boxShadow: plusHighlight > 0.5 ? "0 4px 12px rgba(234,88,12,0.4)" : "none",
                  fontWeight: 700,
                }}
              >
                +
              </div>
            </div>

            {/* Existing pet */}
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${ORANGE}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: ORANGE, fontWeight: 800 }}>מ</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>מיקי</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>גולדן רטריבר · 2 שנים</div>
              </div>
            </div>

            {/* New pet card animating in */}
            <div
              style={{
                background: "#fff7ed",
                border: `1px solid ${ORANGE}40`,
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: newCardOpacity,
                transform: `scale(${newCardScale})`,
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${ORANGE}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: ORANGE, fontWeight: 800 }}>ר</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>ראלף</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>לברדור · 1 שנה</div>
              </div>
              <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", borderRadius: 4, padding: "1px 6px", fontWeight: 700, marginRight: "auto" }}>חדש</span>
            </div>
          </div>
        </div>

        {/* Backdrop over right side */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            marginRight: SIDEBAR_W + 220,
            background: "rgba(15,23,42,0.5)",
            opacity: backdropOpacity,
            borderRadius: 0,
          }}
        />

        {/* Modal */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `calc(60% - ${SIDEBAR_W / 2}px)`,
            transform: `translate(-50%, -50%) scale(${modalScale})`,
            opacity: modalOpacity,
            background: "white",
            borderRadius: 16,
            padding: "24px 28px",
            width: 380,
            boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
            direction: "rtl",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0f172a" }}>הוסף חיית מחמד</h2>
          </div>

          {/* Fields */}
          {[
            { label: "שם החיה", value: "ראלף", op: field1Opacity },
            { label: "גזע", value: "לברדור", op: field2Opacity },
            { label: "מין", value: "זכר", op: field3Opacity },
            { label: "תאריך לידה", value: "12.3.2025", op: field4Opacity },
          ].map((f) => (
            <div key={f.label} style={{ marginBottom: 12, opacity: f.op }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{f.label}</div>
              <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#0f172a" }}>
                {f.value}
              </div>
            </div>
          ))}

          <div
            style={{
              background: saveHighlight > 0.5 ? ORANGE : "#0f172a",
              color: "white",
              borderRadius: 10,
              padding: "11px",
              fontSize: 13,
              fontWeight: 700,
              textAlign: "center",
              cursor: "pointer",
              marginTop: 8,
              boxShadow: saveHighlight > 0.5 ? "0 4px 20px rgba(234,88,12,0.4)" : "none",
            }}
          >
            שמור
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
