// Pure server component — no client hooks
import {
  Bell,
  CalendarDays,
  Home,
  Users,
  MessageCircle,
  CreditCard,
  TrendingUp,
  CheckCircle2,
  Clock,
} from "lucide-react";

const APPOINTMENTS = [
  { time: "09:00", name: "רונית לוי", pet: "בובו — גולדן רטריבר", tag: "אושר ✓", tagClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", bar: "bg-brand-500" },
  { time: "10:30", name: "יעל כהן", pet: "ביסקוויט — פודל", tag: "תזכורת נשלחה", tagClass: "text-sky-400 bg-sky-500/10 border-sky-500/20", bar: "bg-sky-500" },
  { time: "12:00", name: "דני גולד", pet: "לאו — ספניאל קוקר", tag: "ממתין", tagClass: "text-amber-400 bg-amber-500/10 border-amber-500/20", bar: "bg-amber-500" },
  { time: "14:30", name: "שירה מזרחי", pet: "ברוני — לברדור", tag: "אושר ✓", tagClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", bar: "bg-emerald-500" },
];

const NAV_ICONS = [
  { Icon: Home, label: "בית", active: false },
  { Icon: CalendarDays, label: "יומן", active: true },
  { Icon: Users, label: "לקוחות", active: false },
  { Icon: MessageCircle, label: "הודעות", active: false },
  { Icon: CreditCard, label: "תשלומים", active: false },
];

const CHART_BARS = [28, 44, 36, 60, 52, 74, 68];

export function DashboardMockup() {
  return (
    <div className="w-full select-none" dir="rtl" aria-hidden="true">
      {/* Browser chrome */}
      <div className="bg-[#1e293b] rounded-t-2xl px-4 py-2.5 flex items-center gap-3 border border-b-0 border-white/10">
        <div className="flex gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]/80" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e]/80" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]/80" />
        </div>
        <div className="flex-1 bg-[#0f172a]/60 rounded-md px-3 py-1 text-slate-400 text-[11px] text-center font-mono tracking-tight">
          app.petra-app.com
        </div>
        <div className="w-16 shrink-0" />
      </div>

      {/* App window */}
      <div
        className="bg-[#0f172a] rounded-b-2xl overflow-hidden border border-t-0 border-white/10 flex"
        style={{ height: 400 }}
      >
        {/* Sidebar */}
        <div className="w-[52px] bg-[#080f1a] border-l border-white/6 flex flex-col items-center py-4 gap-1.5 shrink-0">
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-xl bg-brand-500 flex items-center justify-center mb-3 shadow-lg shadow-brand-500/40">
            <span className="text-white text-sm font-black" style={{ fontFamily: "Georgia, serif" }}>P</span>
          </div>
          {NAV_ICONS.map(({ Icon, label, active }) => (
            <div
              key={label}
              title={label}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                active
                  ? "bg-brand-500/20 ring-1 ring-brand-500/30"
                  : "opacity-25"
              }`}
            >
              <Icon
                className={`w-4 h-4 ${active ? "text-brand-400" : "text-slate-400"}`}
              />
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          {/* Topbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/6 shrink-0">
            <div>
              <div className="text-white font-semibold text-sm">שלום, מירב 👋</div>
              <div className="text-slate-500 text-[10px]">יום שלישי, 17 מרץ 2026</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-7 h-7 rounded-full bg-white/6 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-slate-400" />
                <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-brand-500 border-2 border-[#0f172a] flex items-center justify-center">
                  <span className="text-white text-[7px] font-bold">3</span>
                </div>
              </div>
              <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center shadow-sm">
                <span className="text-white text-xs font-bold">מ</span>
              </div>
            </div>
          </div>

          {/* Body: 2-col layout */}
          <div className="flex-1 overflow-hidden p-4 grid grid-cols-[1fr_200px] gap-4">

            {/* Left: appointment list */}
            <div className="flex flex-col gap-2.5 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-slate-300 text-[11px] font-semibold uppercase tracking-wider">תורים היום</span>
                <span className="text-brand-400 text-[10px] font-semibold bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">
                  12 תורים ✓
                </span>
              </div>

              {APPOINTMENTS.map((a) => (
                <div
                  key={a.time}
                  className="flex items-center gap-2.5 bg-white/[0.04] rounded-xl px-3 py-2.5 border border-white/[0.06]"
                >
                  <div className={`w-0.5 h-7 rounded-full ${a.bar} shrink-0`} />
                  <span className="text-slate-500 text-[10px] shrink-0 w-10 tabular-nums">{a.time}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-[11px] font-medium leading-tight">{a.name}</div>
                    <div className="text-slate-500 text-[9px] truncate">{a.pet}</div>
                  </div>
                  <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full shrink-0 border ${a.tagClass}`}>
                    {a.tag}
                  </span>
                </div>
              ))}

              {/* WhatsApp sent chip */}
              <div className="flex items-center gap-2 bg-emerald-500/8 rounded-xl px-3 py-2 border border-emerald-500/15 mt-0.5">
                <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center shrink-0 shadow-sm">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
                <span className="text-emerald-300 text-[10px] font-medium">4 תזכורות WhatsApp יצאו הבוקר ✓✓</span>
              </div>
            </div>

            {/* Right: stat cards */}
            <div className="flex flex-col gap-3">

              {/* Revenue card with mini chart */}
              <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06] flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-400 text-[10px]">הכנסה החודש</span>
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="text-white text-xl font-bold mb-0.5">₪8,400</div>
                <div className="text-emerald-400 text-[9px] font-medium mb-2">↑ 18% השבוע</div>
                {/* Mini bar chart */}
                <div className="flex items-end gap-0.5 h-8">
                  {CHART_BARS.map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm transition-all ${
                        i === CHART_BARS.length - 1 ? "bg-brand-500" : "bg-white/10"
                      }`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>

              {/* WhatsApp status */}
              <div className="bg-emerald-500/8 rounded-xl p-3 border border-emerald-500/15">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: "pulse 2s infinite" }} />
                  <span className="text-emerald-300 text-[10px] font-medium">WhatsApp API פעיל</span>
                </div>
                <div className="text-emerald-100 text-sm font-bold">4 תזכורות</div>
                <div className="text-emerald-500 text-[9px]">יצאו הבוקר אוטומטית</div>
              </div>

              {/* Clients */}
              <div className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06]">
                <div className="text-slate-400 text-[10px] mb-1">לקוחות פעילים</div>
                <div className="text-white text-xl font-bold">86</div>
                <div className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 text-slate-500" />
                  <span className="text-slate-500 text-[9px]">+5 החודש</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
