# 005 — Floating WhatsApp and accessibility buttons: exact properties, real press feedback

- **Status**: DONE (fix/landing-motion)
- **Commit**: 968bd105
- **Severity**: MEDIUM
- **Category**: Performance / Easing / Physicality
- **Estimated scope**: 2 files, 3 class strings

## Problem

```tsx
// src/app/landing/_components/AccessibilityButton.tsx:299
className="... hover:bg-blue-700 ... shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 ..."

// src/app/landing/_components/WhatsAppFAB.tsx:14
className="... hover:bg-[#1ebe5d] hover:shadow-xl transition-all duration-200 group ..."

// src/app/landing/_components/WhatsAppFAB.tsx:17
className="text-sm font-semibold overflow-hidden max-w-0 group-hover:max-w-xs transition-all duration-300 whitespace-nowrap hidden sm:inline"
```

- `transition-all` animates every property that changes (incl. focus ring, layout), on two elements that are on screen the whole visit.
- `hover:scale-110` at 300ms default curve is a large, slow jump; it isn't gated to mouse devices (sticks after a tap on mobile) and there is no press feedback.
- The FAB label animates `max-width` to `max-w-xs` (320px) while the label is ~80px wide: most of the 300ms is spent "opening" empty space, so the expand starts late and the collapse starts with a dead pause.

## Target

AccessibilityButton trigger (`:299`) — replace `hover:scale-110 transition-all duration-300` with:

```
transition-[transform,background-color,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 active:scale-[0.97]
```

WhatsAppFAB anchor (`:14`) — replace `transition-all duration-200` with:

```
transition-[transform,background-color,box-shadow] duration-200 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97]
```

WhatsAppFAB label (`:17`) — replace `group-hover:max-w-xs transition-all duration-300` with:

```
group-hover:max-w-[7rem] transition-[max-width] duration-300 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]
```

## Repo conventions to follow

- The curve is the landing token `--lp-ease` value (`globals.css:429`); Tailwind arbitrary property `[transition-timing-function:...]` inlines it (`ease-[...]` is ambiguous in this Tailwind config) since these components use utility classes.
- Hover gating matches plan 003.

## Steps

1. Edit `AccessibilityButton.tsx:299` class string as above (keep all other classes).
2. Edit `WhatsAppFAB.tsx:14` and `:17` as above.

## Boundaries

- Do NOT change the accessibility panel itself (its open/close is a separate, later finding).
- Do NOT change colors, sizes, positions or aria attributes.

## Verification

- **Mechanical**: `next build` succeeds.
- **Feel check**: desktop — hover the WhatsApp FAB: label slides out immediately, collapses immediately on leave. Hover the accessibility button: subtle grow, press dips to 0.97. Mobile emulation — tap the accessibility button: no stuck enlarged state.
- **Done when**: neither component contains `transition-all`.
