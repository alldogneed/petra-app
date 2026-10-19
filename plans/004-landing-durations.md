# 004 — Tighten landing hover/press durations under 300ms

- **Status**: DONE (fix/landing-motion)
- **Commit**: 968bd105
- **Severity**: MEDIUM
- **Category**: Easing & duration
- **Estimated scope**: 1 file, 2 lines

## Problem

```css
/* src/app/globals.css:433 */
.lp-press { transition: transform 380ms var(--lp-ease), box-shadow 380ms var(--lp-ease), opacity 200ms ease; }
/* src/app/globals.css:441 */
.lp-card { transition: transform 420ms var(--lp-ease), box-shadow 420ms var(--lp-ease), border-color 200ms ease; }
```

Buttons and cards are UI responding to the user; anything over ~300ms reads as lag. Release from the `:active` press (90ms down) takes 380ms to come back, so a quick tap feels mushy. The curve (`--lp-ease: cubic-bezier(0.22, 1, 0.36, 1)`) is a good strong ease-out and stays.

## Target

```css
.lp-press { transition: transform 200ms var(--lp-ease), box-shadow 200ms var(--lp-ease), opacity 200ms ease; }
.lp-card  { transition: transform 250ms var(--lp-ease), box-shadow 250ms var(--lp-ease), border-color 200ms ease; }
```

## Repo conventions to follow

- Keep using `var(--lp-ease)`; no new tokens.
- Leave entrance animations (`lpRise` 700ms, `.lp-reveal` 600/700ms) alone — marketing entrances may be longer.

## Steps

1. Edit the two declarations exactly as in Target.

## Boundaries

- Only these two rules.

## Verification

- **Mechanical**: `next build` succeeds.
- **Feel check**: tap/click a CTA rapidly several times — it springs back immediately, never lags behind the finger. Hover a card on desktop — lift is quick but not abrupt. DevTools Animations at 10%: the press goes down in 90ms and returns in 200ms.
- **Done when**: no landing hover/press transition exceeds 250ms.
