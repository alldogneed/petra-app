# 001 — Stop the clients marquee from strobing under reduced motion

- **Status**: DONE (fix/landing-motion)
- **Commit**: 968bd105
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 1 file, ~4 lines

## Problem

`src/app/globals.css:329` forces every animation to a near-zero duration for reduced-motion users:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

The marquee in `src/app/landing/_components/ClientsMarquee.tsx:27-36` is an **infinite** keyframe animation:

```css
.petra-track {
  animation: petra-marquee 40s linear infinite;
}
```

With `0.01ms` per iteration and `infinite` repeats, every painted frame lands on a random point of the loop — the logo row jitters/strobes. That is the opposite of what a user who asked for reduced motion (vestibular disorders, epilepsy) needs. The marquee has no reduced-motion rule of its own.

## Target

Reduced-motion users get a static logo row (no movement at all):

```css
@media (prefers-reduced-motion: reduce) {
  .petra-track { animation: none; transform: none; }
}
```

## Repo conventions to follow

- The marquee's CSS lives in the component's inline `<style>` block (`ClientsMarquee.tsx:26-57`). Add the rule there, after `.petra-logo-item img`.
- Exemplar: `globals.css:471-477` — landing reduced-motion block uses `animation: none`.

## Steps

1. In `ClientsMarquee.tsx`, inside the `<style>{` template literal, append after the `.petra-logo-item img { ... }` rule:
   ```css
   @media (prefers-reduced-motion: reduce) {
     .petra-track { animation: none; transform: none; }
   }
   ```

## Boundaries

- Do NOT edit the global rule in `globals.css:329` (it protects the whole app).
- Do NOT change markup or the normal-motion marquee speed.

## Verification

- **Mechanical**: `npx tsc --noEmit -p .` scoped to the file has no new errors; `next build` succeeds.
- **Feel check**: DevTools → Rendering → emulate `prefers-reduced-motion: reduce`, open `/landing`, scroll to "עסקים כמוכם כבר בפטרה." The logo row is perfectly still. Turn emulation off: the row scrolls smoothly at the old speed.
- **Done when**: computed `animation-name` of `.petra-track` is `none` under reduced motion.
