import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FONT = "'Segoe UI', -apple-system, 'Arial Hebrew', Arial, sans-serif";
const ORANGE = "#ea580c";
const BG = "#f1f5f9";

interface Appointment {
  time: string;
  pet: string;
  breed: string;
  service: string;
  owner: string;
  color: string;
  delay: number;
}

const APPOINTMENTS: Appointment[] = [
  { time: "09:00", pet: "מקס", breed: "לברדור", service: "אילוף בסיסי", owner: "דני כהן", color: "#2563eb", delay: 30 },
  { time: "10:30", pet: "בלה", breed: "פינצ'ר", service: "טיפוח ועיצוב", owner: "שרה לוי", color: "#ea580c", delay: 55 },
  { time: "14:00", pet: "רקי", breed: "האסקי", service: "אילוף מתקדם", owner: "מיכל ברנשטיין", color: "#7c3aed", delay: 80 },
  { time: "16:30", pet: "קפה", breed: "שפניה", service: "בדיקת בריאות", owner: "דוד אברהם", color: "#16a34a", delay: 105 },
];

const AppointmentRow: React.FC<{ apt: Appointment; frame: number; fps: number }> = ({
  apt,
  frame,
  fps,
}) => {
  const progress = spring({ frame: frame - apt.delay, fps, config: { damping: 200 } });
  const rowX = interpolate(progress, [0, 1], [40, 0]);
  const rowOpacity = interpolate(frame, [apt.delay, apt.delay + 12], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        background: "white",
        borderRadius: 12,
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        opacity: rowOpacity,
        transform: `translateX(${rowX}px)`,
        direction: "rtl",
        border: "1px solid #f1f5f9",
      }}
    >
      {/* Time */}
      <div
        style={{
          background: `${apt.color}18`,
          borderRadius: 8,
          padding: "8px 14px",
          minWidth: 70,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: apt.color }}>{apt.time}</div>
      </div>

      {/* Pet info */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
            {apt.pet}
          </span>
          <span
            style={{
              fontSize: 12,
              color: "#64748b",
              background: "#f8fafc",
              borderRadius: 6,
              padding: "1px 8px",
              border: "1px solid #e2e8f0",
            }}
          >
            {apt.breed}
          </span>
        </div>
        <div style={{ fontSize: 14, color: "#64748b" }}>
          {apt.service} · {apt.owner}
        </div>
      </div>

      {/* Service badge */}
      <div
        style={{
          background: `${apt.color}15`,
          borderRadius: 20,
          padding: "4px 14px",
          fontSize: 13,
          fontWeight: 600,
          color: apt.color,
          whiteSpace: "nowrap",
        }}
      >
        {apt.service}
      </div>

      {/* WhatsApp button */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "#dcfce7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
        }}
      >
        💬
      </div>
    </div>
  );
};

export const AppointmentsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, fps * 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.4, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" }
  );
  const opacity = Math.min(fadeIn, fadeOut);

  const headerY = interpolate(
    spring({ frame: frame - 5, fps, config: { damping: 200 } }),
    [0, 1],
    [-30, 0]
  );
  const headerOpacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const whatsappBadgeOpacity = interpolate(frame, [125, 145], [0, 1], {
    extrapolateRight: "clamp",
  });
  const whatsappBadgeScale = spring({ frame: frame - 125, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ background: BG, opacity, direction: "rtl", fontFamily: FONT }}>
      {/* Header */}
      <div
        style={{
          background: "white",
          borderBottom: "1px solid #e2e8f0",
          padding: "18px 48px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          opacity: headerOpacity,
          transform: `translateY(${headerY}px)`,
        }}
      >
        <Img
          src={staticFile("petra-icon.png")}
          style={{ width: 32, height: 32, objectFit: "contain" }}
        />
        <span style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>פטרה</span>
        <div
          style={{
            marginRight: "auto",
            background: "#fff7ed",
            border: "1px solid #fed7aa",
            borderRadius: 8,
            padding: "4px 12px",
            fontSize: 13,
            color: "#9a3412",
            fontWeight: 600,
          }}
        >
          📅 מחר, יום שלישי
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "28px 48px" }}>
        {/* Section label */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
            opacity: interpolate(frame, [10, 25], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 24, background: ORANGE, borderRadius: 4 }} />
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: 0 }}>
              תורים מחר
            </h2>
            <span
              style={{
                background: "#ea580c",
                color: "white",
                borderRadius: 20,
                padding: "2px 10px",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              4
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#64748b",
              fontWeight: 400,
            }}
          >
            לחצו על 💬 לשליחת תזכורת WhatsApp
          </div>
        </div>

        {/* Appointment list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {APPOINTMENTS.map((apt) => (
            <AppointmentRow key={apt.pet} apt={apt} frame={frame} fps={fps} />
          ))}
        </div>

        {/* WhatsApp feature callout */}
        <div
          style={{
            marginTop: 24,
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 12,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            opacity: whatsappBadgeOpacity,
            transform: `scale(${whatsappBadgeScale})`,
          }}
        >
          <span style={{ fontSize: 22 }}>✅</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#166534", marginBottom: 2 }}>
              תזכורות WhatsApp אוטומטיות
            </div>
            <div style={{ fontSize: 13, color: "#166534", opacity: 0.8 }}>
              פטרה שולחת תזכורת ללקוח 24-48 שעות לפני התור — בלי מאמץ
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
