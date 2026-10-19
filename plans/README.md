# Animation plans — Petra landing page

Audit 2026-10-19 (emil-design-eng + improve-animations) of `src/app/landing` + landing block in `src/app/globals.css`, at commit 968bd105.

| # | Title | Severity | Status |
|---|---|---|---|
| 001 | Marquee strobes under reduced motion | HIGH | DONE |
| 002 | Reveal hide-then-fade flash for in-view content | HIGH | DONE |
| 003 | Gate hover lifts to real pointers | MEDIUM | DONE |
| 004 | Hover/press durations under 300ms | MEDIUM | DONE |
| 005 | Floating buttons: exact transitions + press feedback | MEDIUM | DONE |

Order: 001 → 002 → 003 → 004 → 005. 003 and 004 both edit the `.lp-press`/`.lp-card` rules in `globals.css` — do them in sequence. 005 reuses 003's hover-gating pattern.

Not planned yet (from the same audit): FAQ / comparison table snap open while the chevron animates (`PricingSection.tsx`); ProductDemo tab switch swaps screenshots with no crossfade; accessibility panel appears with no enter transition; audience-card image hover uses Tailwind's default curve at 500ms instead of `--lp-ease`.
