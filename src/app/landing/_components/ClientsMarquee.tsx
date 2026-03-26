import Image from "next/image";

const CLIENTS = [
  { src: "/clients/shalom-lekelev.png",   alt: "שלום לכלב" },
  { src: "/clients/iluf-bachan.png",       alt: "אילוף בחן" },
  { src: "/clients/dog-island.png",        alt: "Dog Island" },
  { src: "/clients/nadav-meamen.png",      alt: "נדב מאמן הכלבים" },
  { src: "/clients/liad-yosef.png",        alt: "ליעד יוסף אילוף כלבים" },
  { src: "/clients/beikevot-hartzua.png",  alt: "בעקבות הרצועה" },
  { src: "/clients/itiel.png",             alt: "איתיאל כלבנות" },
  { src: "/clients/doglogic.png",          alt: "DogLogic" },
  { src: "/clients/simba-service.png",     alt: "סימבה כלבי שירות" },
];

export function ClientsMarquee() {
  return (
    <section
      id="לקוחות"
      aria-label="לקוחות פטרה"
      className="relative py-16 overflow-hidden bg-slate-950"
    >
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee-scroll 32s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        .marquee-logo img {
          filter: grayscale(1) brightness(1.8) opacity(0.45);
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

      {/* Fade masks */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-32 z-10"
        style={{ background: "linear-gradient(to right, rgb(2 6 23) 0%, transparent 100%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-32 z-10"
        style={{ background: "linear-gradient(to left, rgb(2 6 23) 0%, transparent 100%)" }}
      />

      {/* Scrolling track — two sets for seamless loop */}
      <div className="overflow-hidden">
        <div className="marquee-track" role="list">
          {[...CLIENTS, ...CLIENTS].map((client, i) => (
            <div
              key={i}
              role="listitem"
              className="marquee-logo flex-shrink-0 mx-10 flex items-center justify-center"
            >
              <div className="relative w-32 h-20">
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

      {/* Counter strip */}
      <div className="mt-12 flex items-center justify-center gap-8 px-4 flex-wrap">
        {[
          { num: "9+", label: "עסקים פעילים" },
          { num: "100%", label: "ישראלי ובעברית" },
          { num: "24/7", label: "תזכורות אוטומטיות" },
        ].map(({ num, label }) => (
          <div key={label} className="text-center">
            <div className="text-2xl font-bold text-brand-400">{num}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
