/**
 * AudienceMockups — coded app-screenshot mockups for each audience card.
 * Server components (no client hooks). Used inside h-44 overflow-hidden containers.
 */

// ── Dog Trainer ────────────────────────────────────────────────────────────────
// Shows: training plan with tasks + progress + automated reminder chip
export function TrainerMockup() {
  const tasks = [
    { label: "ישיבה בפקודה", done: true },
    { label: "שכיבה + הישאר", done: true },
    { label: "הליכה ברצועה", done: false },
    { label: "שחרור מרחוק", done: false },
  ];

  return (
    <div
      className="w-full h-full bg-[#0f172a] p-3 overflow-hidden select-none"
      dir="rtl"
      aria-hidden="true"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-bold text-white">תוכניות אילוף</span>
        <span className="bg-brand-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
          + תוכנית חדשה
        </span>
      </div>

      {/* Plan card */}
      <div className="bg-[#1e293b] rounded-xl p-2.5 border border-white/5 mb-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center text-sm shrink-0">
            🐕
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-[11px] font-bold truncate">ריו — מלינוי</div>
            <div className="text-slate-400 text-[9px]">תוכנית: אילוף בסיסי · שיעור 8/12</div>
          </div>
          <div className="text-brand-400 text-[11px] font-extrabold shrink-0">75%</div>
        </div>

        {/* Progress */}
        <div className="h-1.5 bg-slate-700 rounded-full mb-2.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-l from-brand-500 to-orange-400 rounded-full"
            style={{ width: "75%" }}
          />
        </div>

        {/* Tasks */}
        <div className="space-y-1.5">
          {tasks.map((t) => (
            <div key={t.label} className="flex items-center gap-1.5">
              <div
                className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${
                  t.done ? "bg-emerald-500" : "border border-slate-500"
                }`}
              >
                {t.done && <span className="text-white text-[8px] font-bold">✓</span>}
              </div>
              <span
                className={`text-[10px] leading-tight ${
                  t.done ? "text-slate-500 line-through" : "text-slate-200"
                }`}
              >
                {t.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Reminder chip */}
      <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
        <span className="text-[9px] text-emerald-400 font-bold">✓</span>
        <span className="text-[10px] text-emerald-300">תזכורת WhatsApp נשלחה לבעלים אוטומטית</span>
      </div>
    </div>
  );
}

// ── Groomer ────────────────────────────────────────────────────────────────────
// Shows: appointment card with WA reminder sent + before/after portfolio + paid status
export function GroomerMockup() {
  return (
    <div
      className="w-full h-full bg-[#0f172a] p-3 overflow-hidden select-none"
      dir="rtl"
      aria-hidden="true"
    >
      {/* Appointment header */}
      <div className="bg-[#1e293b] rounded-xl p-2.5 border border-white/5 mb-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-white text-[11px] font-bold">כוכבה — פודל לבן</div>
            <div className="text-slate-400 text-[9px]">שירה לוי · היום 10:30</div>
          </div>
          <div className="bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0 whitespace-nowrap">
            WA ✓ נשלח
          </div>
        </div>
      </div>

      {/* Before / After */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        <div className="bg-slate-800 rounded-xl border border-white/5 overflow-hidden">
          <div className="text-center text-[8px] text-slate-500 py-0.5 bg-slate-800/80">לפני</div>
          <div className="h-14 flex items-center justify-center bg-slate-700/50 text-2xl">
            🐩
          </div>
        </div>
        <div className="bg-[#1e2d3e] rounded-xl border border-purple-500/25 overflow-hidden">
          <div className="text-center text-[8px] text-purple-300 py-0.5 bg-purple-900/20">
            אחרי ✨
          </div>
          <div className="h-14 flex items-center justify-center bg-slate-700/50 text-2xl">
            🐩
          </div>
        </div>
      </div>

      {/* Payment row */}
      <div className="flex items-center gap-2 bg-[#1e293b] rounded-xl px-3 py-2 border border-white/5">
        <span className="text-slate-300 text-[10px]">💳 בקשת תשלום</span>
        <span className="text-slate-500 text-[10px]">₪220</span>
        <div className="mr-auto bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
          שולם ✓
        </div>
      </div>
    </div>
  );
}

// ── Dog Boarding ───────────────────────────────────────────────────────────────
// Shows: room grid (3 occupied, 1 free) + daily WhatsApp update chip
export function BoardingMockup() {
  const rooms = [
    { n: "1", dog: "בוב", breed: "גולדן", from: "22/3", to: "26/3" },
    { n: "2", dog: "לולה", breed: "שיצו", from: "23/3", to: "25/3" },
    { n: "3", dog: "ריקי", breed: "מלטז", from: "24/3", to: "27/3" },
    { n: "4", dog: "", breed: "", from: "", to: "" },
  ];

  return (
    <div
      className="w-full h-full bg-[#0f172a] p-3 overflow-hidden select-none"
      dir="rtl"
      aria-hidden="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-bold text-white">ניהול פנסיון</span>
        <span className="text-[9px] text-slate-400">3/4 חדרים תפוסים</span>
      </div>

      {/* Rooms */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {rooms.map((room) =>
          room.dog ? (
            <div
              key={room.n}
              className="bg-[#1e293b] rounded-xl p-2 border border-white/5"
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-white text-[10px] font-bold">{room.dog}</span>
                <span className="text-[8px] text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded-full">
                  חדר {room.n}
                </span>
              </div>
              <div className="text-[9px] text-slate-400 mb-0.5">{room.breed}</div>
              <div className="flex items-center gap-0.5 text-[8px] text-slate-500">
                <span>{room.from}</span>
                <span className="text-slate-600">→</span>
                <span>{room.to}</span>
              </div>
            </div>
          ) : (
            <div
              key={room.n}
              className="rounded-xl p-2 border border-dashed border-slate-700 flex items-center justify-center"
            >
              <span className="text-[9px] text-slate-600">חדר {room.n} — פנוי</span>
            </div>
          )
        )}
      </div>

      {/* WA daily update */}
      <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">
        <span className="text-[10px] text-emerald-300">📲 עדכון יומי נשלח לכל הבעלים</span>
      </div>
    </div>
  );
}

// ── Service Dog Organization ───────────────────────────────────────────────────
// Shows: dog profile with phase stepper + training hours progress + next exam
export function ServiceDogMockup() {
  const phases = ["בחירה", "גידול", "גור", "אילוף", "מתקדם", "מוסמך"];
  const current = 3; // IN_TRAINING (0-indexed)

  return (
    <div
      className="w-full h-full bg-[#0f172a] p-3 overflow-hidden select-none"
      dir="rtl"
      aria-hidden="true"
    >
      {/* Dog header */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-base shrink-0">
          🦮
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-[11px] font-bold truncate">רקס — גולדן רטריבר</div>
          <div className="text-emerald-400 text-[9px]">שלב: אילוף מתקדם</div>
        </div>
        <div className="text-[9px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
          פעיל
        </div>
      </div>

      {/* Phase stepper — LTR so step 1 is on left */}
      <div className="flex items-center gap-0.5 mb-2.5 overflow-hidden" dir="ltr">
        {phases.map((phase, i) => (
          <div key={phase} className="flex items-center gap-0.5">
            <div
              title={phase}
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold shrink-0 transition-colors ${
                i < current
                  ? "bg-emerald-500 text-white"
                  : i === current
                  ? "bg-brand-500 text-white ring-2 ring-brand-400/30"
                  : "bg-slate-700 text-slate-500"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </div>
            {i < phases.length - 1 && (
              <div
                className={`h-0.5 w-3 rounded-full ${
                  i < current ? "bg-emerald-500" : "bg-slate-700"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Hours progress */}
      <div className="bg-[#1e293b] rounded-xl p-2.5 border border-white/5 mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-slate-400 text-[10px]">שעות אילוף מצטברות</span>
          <span className="text-white text-[10px] font-bold">73 / 120</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-l from-emerald-500 to-emerald-400 rounded-full"
            style={{ width: "61%" }}
          />
        </div>
      </div>

      {/* Next exam */}
      <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
        <span className="text-[10px] text-amber-300">📋 בחינת הסמכה הבאה: 15/4/2026</span>
      </div>
    </div>
  );
}
