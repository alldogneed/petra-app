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

// Triple the list so the marquee fills wide screens and the loop seam is never visible
const TRACK = [...CLIENTS, ...CLIENTS, ...CLIENTS];

export function ClientsMarquee() {
  return (
    <section
      id="לקוחות"
      aria-label="לקוחות פטרה"
      className="relative py-16 overflow-hidden bg-slate-950"
    >
      <style>{`
        @keyframes marquee-ltr {
          0%   { transform: translateX(0); }
          100% { transform: translateX(calc(-100% / 3)); }
        }
        .marquee-track {
          display: flex;
          align-items: center;
          width: max-content;
          animation: marquee-ltr 40s linear infinite;
          will-change: transform;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        .marquee-logo {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 3rem;
        }
        .marquee-logo::after {
          content: "";
          display: block;
          position: absolute;
          right: 0;
          width: 1px;
          height: 2rem;
          background: rgba(255,255,255,0.08);
        }
        .marquee-logo img {
          filter: grayscale(1) brightness(2) opacity(0.4);
          transition: filter 0.4s ease;
        }
        .marquee-logo:hover img {
          filter: grayscale(0) brightness(1) opacity(1);
        }
      `}</style>

      {/* Header */}
      <div className="text-center mb-12 px-4">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
          <span className="text-xs font-semibold tracking-widest text-white/50 uppercase">
            הלקוחות שלנו
          </span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          הם כבר עובדים עם פטרה
        </h2>
        <p className="text-slate-400 text-sm">
          מאלפים, גרומרים ופנסיונים מובילים ברחבי הארץ
        </p>
      </div>

      {/* Fade masks — prevent hard edge at viewport boundary */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-40 z-10"
        style={{ background: "linear-gradient(to right, #020617 0%, transparent 100%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-40 z-10"
        style={{ background: "linear-gradient(to left, #020617 0%, transparent 100%)" }}
      />

      {/* Scrolling track */}
      <div className="overflow-hidden" aria-hidden="true">
        <div className="marquee-track">
          {TRACK.map((client, i) => (
            <div key={i} className="marquee-logo relative">
              <div className="relative w-28 h-16 md:w-32 md:h-20">
                <Image
                  src={client.src}
                  alt={client.alt}
                  fill
                  sizes="128px"
                  className="object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats strip */}
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
            {i < arr.length - 1 && (
              <div className="w-px h-8 bg-white/10" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
