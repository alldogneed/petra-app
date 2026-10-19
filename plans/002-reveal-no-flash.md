# 002 — Reveal: no hide-then-fade flash for content already on screen

- **Status**: DONE (fix/landing-motion)
- **Commit**: 968bd105
- **Severity**: HIGH
- **Category**: Physicality / Purpose
- **Estimated scope**: 1 file, ~20 lines

## Problem

`src/app/landing/_components/Reveal.tsx:20-38` arms the reveal after hydration:

```tsx
useEffect(() => {
  const el = ref.current;
  if (!el) return;
  document.documentElement.classList.add("lp-armed");
  ...
  const io = new IntersectionObserver(...)
```

and `globals.css:453` hides every armed, not-yet-shown block:

```css
.lp-armed .lp-reveal { opacity: 0; transform: translateY(18px); transition: opacity 600ms var(--lp-ease), transform 700ms var(--lp-ease); }
```

Server HTML paints the content visible. `useEffect` runs **after** that paint, adds `lp-armed`, the block jumps to `opacity: 0`, and only on the next IntersectionObserver callback fades back in over 600–700ms. Anything already in the viewport at hydration (tall screens, a reload mid-page, anchor links like `/landing#pricing`) visibly blinks out and back in. Animation should only play for content that is *entering*; content already seen must stay put.

## Target

- Arm in a layout effect (runs before paint).
- If the element already intersects the viewport at that moment, mark it shown synchronously (`classList.add("is-in")`) **before** arming, so it never gets the hidden style and no transition fires.
- Only off-screen elements get the IntersectionObserver reveal.

```tsx
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

useIsoLayoutEffect(() => {
  const el = ref.current;
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (typeof IntersectionObserver === "undefined" || (r.top < window.innerHeight && r.bottom > 0)) {
    el.classList.add("is-in");
    setShown(true);
    document.documentElement.classList.add("lp-armed");
    return;
  }
  document.documentElement.classList.add("lp-armed");
  const io = new IntersectionObserver(/* unchanged */);
  io.observe(el);
  return () => io.disconnect();
}, []);
```

## Repo conventions to follow

- Keep the existing class contract (`lp-reveal`, `is-in`, `lp-armed`, `--lp-d`) — CSS in `globals.css:451-454` stays untouched.
- Keep the file's top comment; update it to mention in-view elements skip the animation.

## Steps

1. Import `useLayoutEffect` from `react`; define `useIsoLayoutEffect` at module scope as above.
2. Replace the `useEffect` body with the target body. Keep the IntersectionObserver options `{ rootMargin: "0px 0px -8% 0px", threshold: 0.08 }` exactly.

## Boundaries

- Do NOT change `globals.css` or any `<Reveal>` call site.
- Do NOT change delays, distances or easing of the reveal itself.

## Verification

- **Mechanical**: scoped `tsc` clean; `next build` succeeds; no "useLayoutEffect does nothing on the server" warning in the build log.
- **Feel check**:
  - Open `/landing#pricing` directly and reload: the pricing block and anything visible around it never blink — they are simply there.
  - Load `/landing` at the top and scroll: the "how it works" / audience / features blocks still rise and fade in with their stagger.
  - CPU throttle 4x (Performance panel) and reload mid-page: still no blink.
  - Reduced motion: everything visible, no movement (unchanged CSS).
- **Done when**: no element visible at load ever drops to `opacity: 0`.
