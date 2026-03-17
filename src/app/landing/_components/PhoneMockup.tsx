// Pure server component — no client hooks needed
export function PhoneMockup() {
  return (
    <div className="w-52 bg-slate-900 rounded-[2.5rem] p-2 shadow-2xl ring-1 ring-white/20 shrink-0">
      {/* Status bar */}
      <div className="relative bg-black rounded-t-[2.1rem] rounded-b-sm px-4 py-1.5 flex items-center justify-between">
        <span className="text-white text-[9px] font-medium">9:41</span>
        {/* Dynamic Island / notch */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1 w-16 h-3.5 bg-black rounded-full" />
        <div className="flex items-center gap-0.5 opacity-75">
          <div className="flex gap-[1.5px] items-end h-[9px]">
            {[3, 5, 7, 9].map((h) => (
              <div key={h} style={{ height: h, width: 2 }} className="bg-white rounded-sm" />
            ))}
          </div>
          <div className="w-4 h-2 border border-white rounded-[2px] mr-0.5">
            <div className="w-2/3 h-full bg-emerald-400 rounded-[1px]" />
          </div>
        </div>
      </div>

      {/* Screen */}
      <div className="bg-white rounded-3xl overflow-hidden">
        {/* App header — dark bar */}
        <div className="bg-[#0F172A] px-3 pt-3 pb-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-[8px]">שלום, מירב 👋</span>
            <div className="w-5 h-5 rounded-full bg-[#F97316] flex items-center justify-center">
              <span className="text-white text-[7px] font-bold">מ</span>
            </div>
          </div>
          <div className="bg-white/10 rounded-lg px-2.5 py-1.5 flex justify-between items-center">
            <div>
              <div className="text-[7px] text-white/50">היום</div>
              <div className="text-white text-[9px] font-bold">17 מרץ</div>
            </div>
            <span className="text-[#F97316] text-[9px] font-bold">12 תורים ✓</span>
          </div>
        </div>

        {/* Appointments */}
        <div className="px-2.5 py-2 space-y-1.5 bg-slate-50">
          <div className="text-[7px] text-slate-400 font-semibold uppercase tracking-wider pb-0.5">
            תורים היום
          </div>
          {[
            { time: "09:00", name: "רונית לוי", pet: "בובו", c: "bg-[#F97316]" },
            { time: "10:30", name: "יעל כהן", pet: "ביסקוויט", c: "bg-blue-500" },
            { time: "12:00", name: "דני גולד", pet: "לאו", c: "bg-emerald-500" },
            { time: "14:30", name: "שירה מ׳", pet: "ברוני", c: "bg-purple-500" },
          ].map((a) => (
            <div
              key={a.time}
              className="flex items-center gap-1.5 bg-white rounded-lg px-2 py-1.5 shadow-sm"
            >
              <div className={`w-0.5 h-6 rounded-full ${a.c} shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="text-[8px] font-semibold text-slate-800 truncate">{a.name}</div>
                <div className="text-[7px] text-slate-400">{a.pet}</div>
              </div>
              <span className="text-[7px] text-slate-500 shrink-0">{a.time}</span>
            </div>
          ))}
        </div>

        {/* WhatsApp reminder chip */}
        <div className="mx-2.5 mb-2 mt-1 flex items-center gap-1.5 bg-emerald-50 rounded-lg px-2 py-1.5 border border-emerald-100">
          <div className="w-3.5 h-3.5 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
          <span className="text-[7px] text-emerald-700 font-medium">תזכורת נשלחה לרונית ✓✓</span>
        </div>

        {/* Bottom nav */}
        <div className="flex justify-around border-t border-slate-100 py-1.5 px-3">
          {(["🏠", "📅", "💬", "👤"] as const).map((icon, i) => (
            <div
              key={i}
              className={`flex flex-col items-center gap-0.5 ${i === 1 ? "opacity-100" : "opacity-25"}`}
            >
              <span className="text-sm leading-none">{icon}</span>
              {i === 1 && (
                <div className="w-1 h-1 rounded-full bg-[#F97316]" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Home indicator */}
      <div className="flex justify-center mt-1.5">
        <div className="w-12 h-[3px] bg-white/20 rounded-full" />
      </div>
    </div>
  );
}
