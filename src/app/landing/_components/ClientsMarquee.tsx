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
  const track = [...CLIENTS, ...CLIENTS];

  return (
    <section
      id="לקוחות"
      aria-label="לקוחות פטרה"
      className="relative py-16 bg-slate-950 overflow-hidden"
    >
      <style>{`
        @keyframes petra-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .petra-track {
          display: flex;
          align-items: center;
          width: max-content;
          animation: petra-marquee 36s linear infinite;
          will-change: transform;
        }
        .petra-track:hover {
          animation-play-state: paused;
        }
        .petra-logo-item {
          flex-shrink: 0;
          width: 160px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .petra-logo-item img {
          filter: grayscale(100%) brightness(200%) opacity(40%);
          transition: filter 0.4s ease;
          object-fit: contain;
          width: 120px !important;
          height: 60px !important;
          position: relative !important;
        }
        .petra-logo-item:hover img {
          filter: grayscale(0%) brightness(100%) opacity(100%);
        }
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

      {/* Fade edges */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-32 z-10"
        style={{ background: "linear-gradient(to right, #020617, transparent)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-32 z-10"
        style={{ background: "linear-gradient(to left, #020617, transparent)" }} />

      {/* Track */}
      <div className="overflow-hidden" aria-hidden="true">
        <div className="petra-track">
          {track.map((c, i) => (
            <div key={i} className="petra-logo-item">
              <Image
                src={c.src}
                alt={c.alt}
                width={120}
                height={60}
                className="object-contain"
              />
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
