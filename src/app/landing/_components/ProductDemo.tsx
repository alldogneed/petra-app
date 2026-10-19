"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Calendar, UserRound, Target, Building2 } from "lucide-react";
import { BrowserShot, PhoneShot } from "./ProductShots";

// Real screens from the demo business (marketing-drafts/landing-review-2026-10-14/app).
const TABS = [
  {
    id: "calendar",
    icon: Calendar,
    label: "יומן תורים",
    text: "רואים מה מחכה לכם היום, מה כבר תפוס ואיפה יש מקום.",
    desktop: { src: "/landing/screens/demo-calendar.webp", alt: "יומן התורים של פטרה בתצוגה שבועית, עם טיפולים ושהיות פנסיון" },
    phone: { src: "/landing/screens/phone-dashboard.webp", alt: "מסך הבית בנייד: פעולות מהירות ומשימות להיום" },
  },
  {
    id: "customer",
    icon: UserRound,
    label: "כרטיס לקוח",
    text: "פרטי הלקוח, החיה, התורים והתשלומים במקום אחד.",
    desktop: { src: "/landing/screens/demo-customer.webp", alt: "כרטיס לקוח: פרטי קשר, חיית מחמד, תורים, תשלומים והזמנות" },
    phone: { src: "/landing/screens/phone-customer.webp", alt: "כרטיס לקוח בנייד: פרטי קשר, תשלומים, מעקב חבילות וחיות מחמד" },
  },
  {
    id: "leads",
    icon: Target,
    label: "לידים",
    text: "רואים מי פנה, עם מי כבר דיברתם ולמי צריך לחזור.",
    desktop: { src: "/landing/screens/hero-leads.webp", alt: "לוח הלידים של פטרה לפי שלבים" },
    phone: { src: "/landing/screens/phone-leads.webp", alt: "מסך הלידים בנייד עם סיכום לידים ושיעור המרה" },
  },
  {
    id: "boarding",
    icon: Building2,
    label: "פנסיון",
    text: "רואים את תפוסת החדרים, מי בצ׳ק-אין ומי מאחר לצ׳ק-אאוט.",
    desktop: { src: "/landing/screens/demo-boarding.webp", alt: "מפת חדרי הפנסיון: חדרים תפוסים ופנויים והתראות צ׳ק-אאוט" },
    phone: { src: "/landing/screens/phone-boarding.webp", alt: "מסך הפנסיון בנייד" },
  },
] as const;

export function ProductDemo() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tab = TABS[active];

  // Arrow keys move between tabs (RTL: ArrowLeft = next)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (active + step + TABS.length) % TABS.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="מסכים מתוך המערכת"
        onKeyDown={onKeyDown}
        className="flex flex-wrap justify-center gap-2 mb-8"
      >
        {TABS.map((t, i) => {
          const Icon = t.icon;
          const selected = i === active;
          return (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab"
              id={`demo-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={selected ? "demo-panel" : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                selected ? "bg-white text-slate-900" : "bg-white/10 text-slate-200 hover:bg-white/15"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="demo-panel" aria-labelledby={`demo-tab-${tab.id}`}>
        <p className="text-center text-lg text-slate-200 mb-8">{tab.text}</p>

        {/* Phone first on small screens: the desktop screen is unreadable at 375px */}
        {/* All tabs stay mounted in one grid cell and crossfade (.lp-stack/.lp-swap): no pop, no blank frame, no height jump */}
        <div className="md:hidden mx-auto w-[240px]">
          <div className="lp-stack">
            {TABS.map((t, i) => (
              <div key={t.id} className="lp-swap" data-active={i === active} aria-hidden={i !== active}>
                <PhoneShot src={t.phone.src} alt={t.phone.alt} width={780} height={1580} />
              </div>
            ))}
          </div>
        </div>

        <div className="hidden md:block mx-auto max-w-[960px]">
          <div className="lp-stack">
            {TABS.map((t, i) => (
              <div key={t.id} className="lp-swap relative pb-10" data-active={i === active} aria-hidden={i !== active}>
                <BrowserShot
                  src={t.desktop.src}
                  alt={t.desktop.alt}
                  width={t.id === "leads" ? 2400 : 1920}
                  height={t.id === "leads" ? 1283 : 1200}
                  sizes="(min-width: 1024px) 960px, 100vw"
                />
                <div className="absolute -bottom-2 -left-4 w-[170px]">
                  <PhoneShot src={t.phone.src} alt={t.phone.alt} width={780} height={1580} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
