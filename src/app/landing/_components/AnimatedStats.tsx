"use client";

import { useEffect, useRef, useState } from "react";

const STATS = [
  { end: 130, suffix: "", label: "עסקים פעילים" },
  { end: 5000, suffix: "+", label: "תורים שנקבעו בהצלחה" },
  { end: 98, suffix: "%", label: "שביעות רצון" },
];

function useCountUp(end: number, duration: number, active: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    function step() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * end));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [active, end, duration]);
  return count;
}

function Stat({
  end,
  suffix,
  label,
  active,
}: {
  end: number;
  suffix: string;
  label: string;
  active: boolean;
}) {
  const count = useCountUp(end, 1800, active);
  const display = end >= 10000 ? count.toLocaleString("he-IL") : count;
  return (
    <div className="text-center text-white">
      {/* dir="ltr" prevents RTL bidi from reordering the suffix (e.g. "+0" instead of "0+") */}
      <dd className="text-4xl md:text-5xl font-extrabold mb-1 tabular-nums" dir="ltr">
        {display}
        {suffix}
      </dd>
      <dt className="text-brand-100 text-sm md:text-base font-medium">{label}</dt>
    </div>
  );
}

export function AnimatedStats() {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDListElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <dl ref={ref} className="max-w-4xl mx-auto px-4 grid grid-cols-3 gap-8">
      {STATS.map((s) => (
        <Stat key={s.label} {...s} active={active} />
      ))}
    </dl>
  );
}
