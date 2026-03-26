"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "#how", label: "איך זה עובד" },
  { href: "#features", label: "מאפיינים" },
  { href: "#pricing", label: "מחירים" },
  { href: "#testimonials", label: "לקוחות" },
];

const WHATSAPP_DEMO =
  "https://wa.me/972515311435?text=%D7%94%D7%99%D7%99%2C%20%D7%90%D7%A9%D7%9E%D7%97%20%D7%9C%D7%A7%D7%91%D7%95%D7%A2%20%D7%93%D7%9E%D7%95%20%D7%9C%D7%A4%D7%98%D7%A8%D7%94";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 60);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on resize to desktop
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setMenuOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-slate-900/95 backdrop-blur-md border-b border-white/8 shadow-xl shadow-black/25"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link
            href="/landing"
            className="flex items-center gap-2.5 shrink-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
            aria-label="פטרה — חזרה לדף הבית"
          >
            <Image
              src="/petra-logo.png"
              alt=""
              width={32}
              height={32}
              className="object-contain"
            />
            <span className="text-white font-bold text-lg tracking-tight">
              פטרה
            </span>
          </Link>

          {/* Desktop nav */}
          <nav aria-label="ניווט ראשי" className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="px-3.5 py-2 text-sm text-slate-300 hover:text-white rounded-lg hover:bg-white/8 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              כניסה
            </Link>
            <a
              href={WHATSAPP_DEMO}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="קבע דמו — נפתח בחלון חדש"
              className="text-sm px-4 py-2 rounded-xl border border-white/20 text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/40"
            >
              דמו חינמי
            </a>
            <Link
              href="/register"
              className="text-sm font-semibold px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white transition-colors shadow-lg shadow-brand-500/25 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              התחל בחינם עכשיו
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            aria-label={menuOpen ? "סגור תפריט" : "פתח תפריט"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 text-slate-300 hover:text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            {menuOpen ? (
              <X className="w-5 h-5" aria-hidden="true" />
            ) : (
              <Menu className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 py-4 space-y-1 bg-slate-900/95 backdrop-blur-md -mx-4 px-4 sm:-mx-6 sm:px-6">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/8 rounded-xl transition-colors"
              >
                {label}
              </a>
            ))}
            <div className="pt-3 flex flex-col gap-2">
              <Link
                href="/register"
                onClick={() => setMenuOpen(false)}
                className="text-sm font-semibold px-4 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-center transition-colors"
              >
                התחל בחינם עכשיו
              </Link>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="text-sm text-slate-400 hover:text-white transition-colors text-center py-2"
              >
                כניסה לחשבון
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
