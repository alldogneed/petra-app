"use client";

export interface SectionNavItem {
  id: string;
  label: string;
}

/**
 * Sticky anchor chips for the customer card. The chip row scrolls horizontally
 * inside itself on narrow screens — it never widens the page.
 * Target sections need `scroll-mt-32` so they land below the topbar + this bar.
 */
export function SectionNav({ items }: { items: SectionNavItem[] }) {
  return (
    <nav
      aria-label="ניווט בכרטיס הלקוח"
      className="sticky top-16 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-petra-bg/90 backdrop-blur no-print"
    >
      <div className="flex gap-2 overflow-x-auto max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => (
          <a
            key={it.id}
            href={`#${it.id}`}
            onClick={(e) => {
              const el = document.getElementById(it.id);
              if (!el) return;
              e.preventDefault();
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              history.replaceState(null, "", `#${it.id}`);
            }}
            className="flex-shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 transition-colors"
          >
            {it.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
