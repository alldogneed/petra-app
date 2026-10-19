# 009 — Audience card image zoom uses the landing curve

- **Status**: DONE (fix/landing-motion-2)
- **Commit**: 9a46009c
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file, 1 class string

## Problem

`src/app/landing/page.tsx:459`: `transition-transform duration-500` uses Tailwind's default curve (`cubic-bezier(0.4, 0, 0.2, 1)`) at 500ms, while the card it sits in lifts with `--lp-ease` at 250ms. The two motions are out of sync.

## Target

`transition-transform duration-300 [transition-timing-function:var(--lp-ease)]`

## Steps

1. Replace `transition-transform duration-500` with the target classes (keep the hover-gated scale class).

## Verification

- **Mechanical**: `next build` succeeds.
- **Feel check**: hover an audience card on desktop — card lift and image zoom start together and settle almost together.
- **Done when**: no landing transition uses Tailwind's default curve for this zoom.
