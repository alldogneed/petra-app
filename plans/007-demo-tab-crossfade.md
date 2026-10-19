# 007 — ProductDemo: crossfade screenshots on tab change

- **Status**: DONE (fix/landing-motion-2)
- **Commit**: 9a46009c
- **Severity**: LOW
- **Category**: Missed opportunity / Preventing jarring changes
- **Estimated scope**: 2 files, ~40 lines

## Problem

`src/app/landing/_components/ProductDemo.tsx` renders only the active tab's screenshots. Changing tabs swaps `src` instantly: the image pops, the not-yet-loaded image can flash empty, and the panel height jumps (leads screen is 2400×1283, others 1920×1200).

## Target

All tabs' shots stay mounted in one grid cell (stacked); only the active one is visible. Switching is an interruptible opacity + slight blur crossfade (blur masks the two-images-overlapping look):

```css
.lp-stack { display: grid; }
.lp-stack > * { grid-area: 1 / 1; }
.lp-swap { opacity: 0; filter: blur(2px); visibility: hidden; transition: opacity 250ms var(--lp-ease), filter 250ms var(--lp-ease), visibility 0s linear 250ms; }
.lp-swap[data-active="true"] { opacity: 1; filter: none; visibility: visible; transition-delay: 0s; }
/* reduced motion */
.lp-swap { filter: none; transition: opacity 150ms ease, visibility 0s linear 150ms; }
```

The stack takes the tallest shot's height, so the section no longer jumps. Inactive layers get `aria-hidden`.

## Steps

1. `globals.css`: add the rules after the `.lp-collapse` rules; reduced-motion override in the landing reduced-motion block.
2. `ProductDemo.tsx`: inside the tabpanel, wrap the mobile phone shot block and the desktop block each in `<div className="lp-stack">` and map over `TABS`, rendering one `<div className="lp-swap" data-active={i === active} aria-hidden={i !== active}>` per tab with that tab's shots (same props as today, using `t` instead of `tab`). Keep `md:hidden` / `hidden md:block` on the outer wrappers.
3. Text paragraph stays a simple swap.

## Boundaries

- No change to tabs, keyboard handling, copy or image assets.

## Verification

- **Mechanical**: `next build` succeeds.
- **Feel check**: click through all tabs quickly — screenshots crossfade, clicking mid-fade retargets smoothly, no empty frame, section height stays fixed. 10% playback: no visible double image.
- **Done when**: tab change never shows a blank or popping image.
