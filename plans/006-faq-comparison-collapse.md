# 006 — FAQ answers and comparison table open/close smoothly

- **Status**: DONE (fix/landing-motion-2)
- **Commit**: 9a46009c
- **Severity**: LOW
- **Category**: Missed opportunity / Preventing jarring changes
- **Estimated scope**: 2 files, ~40 lines

## Problem

`src/app/landing/_components/PricingSection.tsx` mounts content conditionally, so it snaps in and out while only the chevron animates (200ms):

```tsx
// FaqAccordion, ~line 251
{isOpen && (
  <div className="px-4 pb-4 text-slate-500 text-sm leading-relaxed border-t border-slate-100 pt-3">{a}</div>
)}
// PricingSection, ~line 462
{showComparison && (
  <div id="comparison-table" className="mt-8 overflow-x-auto rounded-2xl border border-slate-200" role="region" ...>
```

The FAQ button also lacks `aria-expanded` / `aria-controls`.

## Target

A reusable collapse that mirrors the existing mobile-menu pattern (`.lp-menu`, `globals.css` ~line 465): always mounted, `grid-template-rows: 0fr → 1fr`, interruptible (transition, not keyframes), hidden content removed from tab order/a11y tree with `visibility` after the close finishes.

```css
.lp-collapse { display: grid; grid-template-rows: 0fr; opacity: 0; transition: grid-template-rows 250ms var(--lp-ease), opacity 200ms ease; }
.lp-collapse[data-open="true"] { grid-template-rows: 1fr; opacity: 1; }
.lp-collapse > div { overflow: hidden; min-height: 0; visibility: hidden; transition: visibility 0s linear 250ms; }
.lp-collapse[data-open="true"] > div { visibility: visible; transition-delay: 0s; }
/* in the landing reduced-motion block */
.lp-collapse { transition: opacity 150ms ease; }
```

## Steps

1. `globals.css`: add the four rules after `.lp-menu > div { ... }`; add `.lp-collapse { transition: opacity 150ms ease; }` inside the landing `@media (prefers-reduced-motion: reduce)` block.
2. FAQ: give each answer id `faq-a-${i}`; button gets `aria-expanded={isOpen}` `aria-controls={"faq-a-" + i}`; replace the conditional with
   `<div id={...} className="lp-collapse" data-open={isOpen}><div><div className="px-4 pb-4 ... pt-3">{a}</div></div></div>` (keep the original inner classes).
3. Comparison: replace `{showComparison && (<div id="comparison-table" ...>…</div>)}` with
   `<div className="lp-collapse" data-open={showComparison}><div><div id="comparison-table" ... same classes/attributes ...>…</div></div></div>`.

## Boundaries

- No content, copy or table structure changes. No new dependencies.

## Verification

- **Mechanical**: `next build` succeeds.
- **Feel check**: click a FAQ question — answer grows open in ~250ms together with the chevron; click again mid-animation — it reverses from where it is. Comparison table opens/closes the same way. Tab key never lands inside a closed answer/table. Reduced motion: opacity fade only.
- **Done when**: no conditional mount remains for FAQ answers or the comparison table.
