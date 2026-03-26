"use client";
import Image from "next/image";

const CLIENTS = [
  { src: "/clients/shalom-lekelev.png",  alt: "שלום לכלב" },
  { src: "/clients/iluf-bachan.png",      alt: "אילוף בחן" },
  { src: "/clients/dog-island.png",       alt: "Dog Island" },
  { src: "/clients/nadav-meamen.png",     alt: "נדב מאמן הכלבים" },
  { src: "/clients/liad-yosef.png",       alt: "ליעד יוסף אילוף כלבים" },
  { src: "/clients/beikevot-hartzua.png", alt: "בעקבות הרצועה" },
  { src: "/clients/itiel.png",            alt: "איתיאל כלבנות" },
  { src: "/clients/doglogic.png",         alt: "DogLogic" },
  { src: "/clients/simba-service.png",    alt: "סימבה כלבי שירות" },
];

export function ClientsMarquee() {
  // Duplicate twice — animation moves exactly -50% so the loop is perfectly seamless
  const track = [...CLIENTS, ...CLIENTS];

  return (
    <section
      id="לקוחות"
      aria-label="לקוחות פטרה"
      className="relative py-16 bg-slate-950 overflow-hidden"
    >
      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-inner {
          display: flex;
          width: max-content;
          animation: marquee 36s linear infinite;
          will-change: transform;
        }
        .marquee-inner:hover { animation-play-state: paused; }
      `}</style>

      {/* Header */}
      <div className="text-center mb-12 px-4">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-xs font-semibold tracking-widest text-white/50 uppercase">הלקוחות שלנו</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">הם כבר עובדים עם פטרה</h2>
        <p className="text-slate-400 text-sm">מאלפים, גרומרים ופנסיונים מובילים ברחבי הארץ</p>
      </div>

      {/* Left/right fade */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-32 z-10"
        style={{ background: "linear-gradient(to right, #020617, transparent)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-32 z-10"
        style={{ background: "linear-gradient(to left, #020617, transparent)" }} />

      {/* Track */}
      <div className="overflow-hidden" aria-hidden="true">
        <div className="marquee-inner">
          {track.map((c, i) => (
            <div
              key={i}
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: "160px", height: "80px", padding: "0 16px" }}
            >
              <div style={{ position: "relative", width: "128px", height: "64px" }}>
                <Image
                  src={c.src}
                  alt={c.alt}
                  fill
                  sizes="128px"
                  className="object-contain"
                  style={{ filter: "grayscale(1) brightness(2) opacity(0.45)", transition: "filter .4s" }}
                  onMouseEnter={e => (e.currentTarget.style.filter = "none")}
                  onMouseLeave={e => (e.currentTarget.style.filter = "grayscale(1) brightness(2) opacity(0.45)")}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-12 flex items-center justify-center gap-10 px-4 flex-wrap">
        {[
          { num: "117", label: "עסקים פעילים" },
          { num: "100%", label: "ישראלי ובעברית" },
          { num: "24/7", label: "תזכורות אוטומטיות" },
        ].map(({ num, label }, i, arr) => (
          <div key={label} className="flex items-center gap-10">
            <div className="text-center">
              <div className="text-2xl font-bold text-brand-400">{num}</div>
              <div className="text-xs text-slate-500 mt-0.5">{label}</div>
            </div>
            {i < arr.length - 1 && <div className="w-px h-8 bg-white/10" aria-hidden="true" />}
          </div>
        ))}
      </div>
    </section>
  );
}
