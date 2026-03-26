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
];

export function ClientsMarquee() {
  return (
    <section
      aria-label="לקוחות פטרה"
      className="relative py-14 overflow-hidden bg-white border-y border-slate-100"
    >
      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .marquee-track {
          display: flex;
          width: max-content;
          animation: marquee-scroll 28s linear infinite;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        .marquee-logo img {
          filter: grayscale(1) opacity(0.55);
          transition: filter 0.35s ease;
        }
        .marquee-logo:hover img {
          filter: grayscale(0) opacity(1);
        }
      `}</style>

      {/* Header */}
      <div className="text-center mb-10 px-4">
        <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-2">
          הם כבר עובדים עם פטרה
        </p>
        <h2 className="text-xl font-bold text-slate-800">
          מאלפים, גרומרים ופנסיונים מובילים ברחבי הארץ
        </h2>
      </div>

      {/* Fade masks */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-32 z-10"
        style={{ background: "linear-gradient(to right, white 0%, transparent 100%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-32 z-10"
        style={{ background: "linear-gradient(to left, white 0%, transparent 100%)" }}
      />

      {/* Scrolling track — two sets for seamless loop */}
      <div className="overflow-hidden">
        <div className="marquee-track" role="list">
          {[...CLIENTS, ...CLIENTS].map((client, i) => (
            <div
              key={i}
              role="listitem"
              className="marquee-logo flex-shrink-0 mx-8 flex items-center justify-center"
            >
              <div className="relative w-28 h-16">
                <Image
                  src={client.src}
                  alt={client.alt}
                  fill
                  sizes="112px"
                  className="object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
