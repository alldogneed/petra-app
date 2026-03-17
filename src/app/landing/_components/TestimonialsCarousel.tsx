"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

interface Testimonial {
  name: string;
  role: string;
  /** Full business name + location, e.g. "סטודיו קנין, תל אביב" */
  business: string;
  /** Initials shown when no avatarUrl is provided */
  initials: string;
  gradientFrom: string;
  gradientTo: string;
  /** URL to a real profile photo. Replace null with a path/URL when available. */
  avatarUrl: string | null;
  quote: string;
  stars: number;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: "יעל כהן",
    role: "מאלפת כלבים בכירה",
    business: "סטודיו קנין, תל אביב",
    initials: "י",
    gradientFrom: "from-orange-400",
    gradientTo: "to-orange-600",
    avatarUrl: null, // TODO: החלף ב-URL לתמונה אמיתית
    quote:
      "פטרה שינתה לי את החיים. כל הלקוחות, התוכניות, התזכורות — הכל במקום אחד. חסכתי 2 שעות ביום לפחות.",
    stars: 5,
  },
  {
    name: "מוריה לוי",
    role: "גרומרת מקצועית",
    business: "פגי גרומינג, ירושלים",
    initials: "מ",
    gradientFrom: "from-purple-400",
    gradientTo: "to-pink-500",
    avatarUrl: null, // TODO: החלף ב-URL לתמונה אמיתית
    quote:
      "התורים מתמלאים לבד, הלקוחות מקבלים תזכורת בוואטסאפ וגם החשבוניות נשלחות אוטומטית. ממליצה בחום!",
    stars: 5,
  },
  {
    name: "דני אברהם",
    role: "בעלים ומנהל",
    business: "פנסיון דוגי, חיפה",
    initials: "ד",
    gradientFrom: "from-blue-400",
    gradientTo: "to-indigo-500",
    avatarUrl: null, // TODO: החלף ב-URL לתמונה אמיתית
    quote:
      "הפנסיון שלי עם 20 חדרים — ומעולם לא היה לי כל כך פשוט לנהל. Check-in/out, עדכונים לבעלים, הכל חלק.",
    stars: 5,
  },
];

export function TestimonialsCarousel() {
  const [current, setCurrent] = useState(0);

  function goTo(idx: number) {
    setCurrent((idx + TESTIMONIALS.length) % TESTIMONIALS.length);
  }

  // Auto-advance every 6 s; resets when user manually navigates
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrent((c) => (c + 1) % TESTIMONIALS.length);
    }, 6000);
    return () => clearTimeout(timer);
  }, [current]);

  const t = TESTIMONIALS[current];

  return (
    <div className="relative max-w-2xl mx-auto">
      {/* Card */}
      <figure
        aria-live="polite"
        aria-atomic="true"
        className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm relative overflow-hidden min-h-[260px] flex flex-col"
      >
        {/* Decorative quote mark */}
        <div
          aria-hidden="true"
          className="absolute top-2 left-4 text-8xl font-serif text-slate-100 leading-none select-none pointer-events-none"
        >
          &ldquo;
        </div>

        {/* Stars */}
        <div
          aria-label={`דירוג ${t.stars} מתוך 5 כוכבים`}
          className="flex gap-0.5 mb-4 relative"
        >
          {Array.from({ length: t.stars }).map((_, i) => (
            <Star
              key={i}
              aria-hidden="true"
              className="w-4 h-4 fill-amber-400 text-amber-400"
            />
          ))}
        </div>

        {/* Quote */}
        <blockquote className="relative flex-1 mb-6">
          <p className="text-slate-700 text-base leading-relaxed">
            &ldquo;{t.quote}&rdquo;
          </p>
        </blockquote>

        {/* Author */}
        <figcaption className="flex items-center gap-3">
          {/* Avatar: real photo if provided, gradient initials as fallback */}
          <div
            aria-hidden="true"
            className={`w-12 h-12 rounded-full shrink-0 ring-2 ring-white shadow-md overflow-hidden ${t.avatarUrl ? "" : `bg-gradient-to-br ${t.gradientFrom} ${t.gradientTo} flex items-center justify-center`}`}
          >
            {t.avatarUrl ? (
              <Image
                src={t.avatarUrl}
                alt=""
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-white font-bold text-base">{t.initials}</span>
            )}
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-sm">{t.name}</div>
            <div className="text-xs text-slate-500">{t.role}</div>
            <div className="text-xs font-medium text-brand-600 mt-0.5">{t.business}</div>
          </div>
        </figcaption>
      </figure>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          onClick={() => goTo(current - 1)}
          aria-label="המלצה קודמת"
          className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Dots */}
        <div className="flex items-center gap-2" role="tablist" aria-label="בחירת המלצה">
          {TESTIMONIALS.map((_, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === current}
              aria-label={`המלצה ${i + 1}`}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                i === current
                  ? "w-6 h-2.5 bg-brand-500"
                  : "w-2.5 h-2.5 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => goTo(current + 1)}
          aria-label="המלצה הבאה"
          className="w-9 h-9 rounded-full border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
