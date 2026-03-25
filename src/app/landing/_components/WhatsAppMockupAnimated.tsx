"use client";

import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";

type Phase = "idle" | "typing" | "message" | "delivered" | "reply";

export function WhatsAppMockupAnimated() {
  const [phase, setPhase] = useState<Phase>("idle");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          runSequence();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function runSequence() {
    // typing dots appear
    setTimeout(() => setPhase("typing"), 400);
    // message slides in
    setTimeout(() => setPhase("message"), 2000);
    // double-check (delivered)
    setTimeout(() => setPhase("delivered"), 2700);
    // customer replies ✅
    setTimeout(() => setPhase("reply"), 3800);
  }

  return (
    <div
      ref={ref}
      className="w-72 rounded-3xl bg-[#0F172A] border border-white/10 overflow-hidden shadow-2xl"
    >
      {/* Header */}
      <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-emerald-300 flex items-center justify-center shrink-0">
          <Heart className="w-4 h-4 text-emerald-800" aria-hidden="true" />
        </div>
        <div>
          <div className="text-white text-sm font-semibold">פטרה — תזכורת תור</div>
          <div className="text-emerald-200 text-xs">מחובר ✓</div>
        </div>
      </div>

      {/* Chat area */}
      <div
        className="px-3 py-4 space-y-3 min-h-[220px]"
        style={{ backgroundColor: "#1a2533" }}
        aria-live="polite"
        aria-atomic="false"
      >
        {/* Typing indicator */}
        {phase === "typing" && (
          <div className="flex justify-start" style={{ animation: "fadeInUp 0.2s ease-out both" }}>
            <div className="bg-[#202C33] rounded-2xl rounded-tr-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full bg-slate-400 block"
                    style={{
                      animation: "typingDot 1.1s ease-in-out infinite",
                      animationDelay: `${i * 0.18}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Outgoing message */}
        {(phase === "message" || phase === "delivered" || phase === "reply") && (
          <div
            className="flex justify-start"
            style={{ animation: "fadeInUp 0.25s ease-out both" }}
          >
            <div className="bg-[#202C33] rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[88%]">
              <p className="text-white text-xs leading-relaxed">
                שלום יעל! 👋
                <br />
                תזכורת לתור של ביסקוויט
                <br />
                <strong>מחר, 10:00</strong> — אצל מירב
                <br />
                <br />
                לאישור: השב ✅
                <br />
                לביטול: השב ❌
              </p>
              <p className="text-[10px] text-slate-400 mt-1 text-left" dir="ltr">
                09:15 {phase === "message" ? "✓" : "✓✓"}
              </p>
            </div>
          </div>
        )}

        {/* Customer reply */}
        {phase === "reply" && (
          <div
            className="flex justify-end"
            style={{ animation: "fadeInUp 0.25s ease-out both" }}
          >
            <div className="bg-[#005C4B] rounded-2xl rounded-tl-sm px-4 py-2.5">
              <p className="text-white text-xs">✅ מגיעה!</p>
              <p className="text-[10px] text-slate-400 mt-1 text-left" dir="ltr">09:17 ✓✓</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
