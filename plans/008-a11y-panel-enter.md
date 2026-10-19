# 008 — Accessibility panel: enter from its trigger

- **Status**: DONE (fix/landing-motion-2)
- **Commit**: 9a46009c
- **Severity**: LOW
- **Category**: Physicality & origin
- **Estimated scope**: 2 files, ~6 lines

## Problem

`src/app/landing/_components/AccessibilityButton.tsx` (~line 170) mounts the panel with `{open && <div role="dialog" ...>}` — it appears from nowhere. The trigger sits below it at the bottom-right corner.

## Target

Mount-only enter animation scaled from the trigger corner; close stays instant (the system responding — and Escape is keyboard-initiated, which must not animate):

```css
@keyframes lpPop { from { opacity: 0; transform: translateY(6px) scale(0.97); } }
.lp-pop { transform-origin: bottom right; animation: lpPop 180ms var(--lp-ease); }
/* reduced motion */
.lp-pop { animation: none; }
```

## Steps

1. `globals.css`: add `@keyframes lpPop` and `.lp-pop` in the landing block; `.lp-pop { animation: none; }` in the landing reduced-motion block.
2. `AccessibilityButton.tsx`: add `lp-pop` to the dialog `className`.

## Boundaries

- No change to panel content, focus or Escape handling.

## Verification

- **Mechanical**: `next build` succeeds.
- **Feel check**: open the panel — it grows ~3% out of the button's corner in 180ms; close — gone instantly.
- **Done when**: panel enter is animated, exit is instant.
