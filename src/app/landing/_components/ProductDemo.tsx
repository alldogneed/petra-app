"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Calendar, UserRound, Target, Building2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_CONFIG, localeFromBusiness } from "@/lib/locale";
import { BrowserShot, PhoneShot } from "./ProductShots";

// Real screens from the demo business (marketing-drafts/landing-review-2026-10-14/app).
const TABS = [
  {
    id: "calendar",
    icon: Calendar,
    desktop: { src: "/landing/screens/demo-calendar.webp" },
    phone: { src: "/landing/screens/phone-dashboard.webp" },
  },
  {
    id: "customer",
    icon: UserRound,
    desktop: { src: "/landing/screens/demo-customer.webp" },
    phone: { src: "/landing/screens/phone-customer.webp" },
  },
  {
    id: "leads",
    icon: Target,
    desktop: { src: "/landing/screens/hero-leads.webp" },
    phone: { src: "/landing/screens/phone-leads.webp" },
  },
  {
    id: "boarding",
    icon: Building2,
    desktop: { src: "/landing/screens/demo-boarding.webp" },
    phone: { src: "/landing/screens/phone-boarding.webp" },
  },
] as const;

export function ProductDemo() {
  const t = useTranslations("landing.productDemo");
  const cfg = LOCALE_CONFIG[localeFromBusiness({ locale: useLocale() })];
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tab = TABS[active];

  // Arrow keys move between tabs (RTL: ArrowLeft = next; LTR: ArrowRight = next)
  const nextKey = cfg.dir === "rtl" ? "ArrowLeft" : "ArrowRight";
  const prevKey = cfg.dir === "rtl" ? "ArrowRight" : "ArrowLeft";
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === nextKey ? 1 : e.key === prevKey ? -1 : 0;
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
        aria-label={t("tablistLabel")}
        onKeyDown={onKeyDown}
        className="flex flex-wrap justify-center gap-2 mb-8"
      >
        {TABS.map((tb, i) => {
          const Icon = tb.icon;
          const selected = i === active;
          return (
            <button
              key={tb.id}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab"
              id={`demo-tab-${tb.id}`}
              aria-selected={selected}
              aria-controls={selected ? "demo-panel" : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                selected ? "bg-white text-slate-900" : "bg-white/10 text-slate-200 hover:bg-white/15"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              {t(`tabs.${tb.id}.label`)}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="demo-panel" aria-labelledby={`demo-tab-${tab.id}`}>
        <p className="text-center text-lg text-slate-200 mb-8">{t(`tabs.${tab.id}.text`)}</p>

        {/* Phone first on small screens: the desktop screen is unreadable at 375px */}
        {/* All tabs stay mounted in one grid cell and crossfade (.lp-stack/.lp-swap): no pop, no blank frame, no height jump */}
        <div className="md:hidden mx-auto w-[240px]">
          <div className="lp-stack">
            {TABS.map((tb, i) => (
              <div key={tb.id} className="lp-swap" data-active={i === active} aria-hidden={i !== active}>
                <PhoneShot src={tb.phone.src} alt={t(`tabs.${tb.id}.phoneAlt`)} width={780} height={1580} />
              </div>
            ))}
          </div>
        </div>

        <div className="hidden md:block mx-auto max-w-[960px]">
          <div className="lp-stack">
            {TABS.map((tb, i) => (
              <div key={tb.id} className="lp-swap relative pb-10" data-active={i === active} aria-hidden={i !== active}>
                <BrowserShot
                  src={tb.desktop.src}
                  alt={t(`tabs.${tb.id}.desktopAlt`)}
                  width={tb.id === "leads" ? 2400 : 1920}
                  height={tb.id === "leads" ? 1283 : 1200}
                  sizes="(min-width: 1024px) 960px, 100vw"
                />
                <div className="absolute -bottom-2 -end-4 w-[170px]">
                  <PhoneShot src={tb.phone.src} alt={t(`tabs.${tb.id}.phoneAlt`)} width={780} height={1580} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
