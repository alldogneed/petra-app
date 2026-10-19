import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

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
      id="clients"
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
          animation: petra-marquee 40s linear infinite;
          will-change: transform;
        }
        .petra-track:hover {
          animation-play-state: paused;
        }
        .petra-logo-item {
          flex-shrink: 0;
          width: 168px;
          height: 88px;
          margin: 0 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px;
          background: #fff;
        }
        .petra-logo-item img {
          object-fit: contain;
          width: 116px !important;
          height: 52px !important;
          position: relative !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .petra-track { animation: none; transform: none; }
        }
      `}</style>

      {/* Header */}
      <div className="text-center mb-12 px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">עסקים כמוכם כבר בפטרה.</h2>
        <p className="text-slate-300 text-base">מאלפים, גרומרים ומנהלי פנסיונים משתמשים בפטרה כדי לעשות סדר ביום העבודה ולהתעסק פחות בניהול.</p>
      </div>

      {/* Track — force LTR so translateX(-50%) works correctly on RTL pages.
          Edges fade via a mask on the track only, so nothing covers the heading or stats. */}
      <div
        className="overflow-hidden"
        aria-hidden="true"
        dir="ltr"
        style={{
          maskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)",
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)",
        }}
      >
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
          { num: "130", label: "עסקים פעילים בישראל" },
          { num: "5,000+", label: "תורים שנקבעו במערכת" },
          { num: "98%", label: "שביעות רצון" },
        ].map(({ num, label }) => (
          <div key={label} className="text-center">
            <div className="text-2xl font-bold text-brand-400">{num}</div>
            <div className="text-sm text-slate-300 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="text-center mt-10 px-4">
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-[15px] font-semibold text-white lp-press focus:outline-none focus:ring-2 focus:ring-brand-400"
          style={{ background: "#C2410C" }}
        >
          התחילו בחינם
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
