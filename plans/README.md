# Animation plans — Petra landing page

Audit 2026-10-19 (emil-design-eng + improve-animations) of `src/app/landing` + landing block in `src/app/globals.css`, at commit 968bd105.

| # | Title | Severity | Status |
|---|---|---|---|
| 001 | Marquee strobes under reduced motion | HIGH | DONE |
| 002 | Reveal hide-then-fade flash for in-view content | HIGH | DONE |
| 003 | Gate hover lifts to real pointers | MEDIUM | DONE |
| 004 | Hover/press durations under 300ms | MEDIUM | DONE |
| 005 | Floating buttons: exact transitions + press feedback | MEDIUM | DONE |
| 006 | FAQ + comparison table open/close smoothly | LOW | DONE |
| 007 | ProductDemo screenshot crossfade | LOW | DONE |
| 008 | Accessibility panel enters from its trigger | LOW | DONE |
| 009 | Audience image zoom uses --lp-ease | LOW | DONE |

Order: 001 → 002 → 003 → 004 → 005. 003 and 004 both edit the `.lp-press`/`.lp-card` rules in `globals.css` — do them in sequence. 005 reuses 003's hover-gating pattern.

006–009 are independent of each other; 006 and 007 both add rules next to `.lp-menu` in `globals.css`.
