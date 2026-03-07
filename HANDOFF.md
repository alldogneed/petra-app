# Petra App — Session Handoff (2026-03-07)

---

## 1. What We Did Today

### Deployment — Production failure investigation & fix
- Production was failing on Vercel for commits `9d4c89d` and `5fd07b6`
- Root cause: TypeScript error "Cannot find name 'AddRecipientInlineModal'" — triggered only when generating Prisma client with the production PostgreSQL schema
- Fix: reproduced locally with `prisma generate --schema=prisma/schema.production.prisma` → build now passes
- Production came back up at commit `ac7fe47` (null-guard fixes already in the repo)

### Protected deployment workflow (dev → staging → main)
- Created 3 branches: `dev`, `staging`, `main` (main already existed)
- Made GitHub repo **public** (was private — branch protection on private repos requires GitHub Pro)
- Set **branch protection rules on `main`** via GitHub API:
  - Direct push blocked — only PRs allowed
  - 1 required approval before merge
  - Stale review dismissal on new commits
  - Force push blocked, branch deletion blocked
  - `enforce_admins: false` so owner can use `gh pr merge --admin` as solo developer
- Created `scripts/deploy.sh` — two modes: `staging` and `production`
- Created `scripts/DEPLOY_CHECKLIST.md` — pre-deploy checklist
- Added `npm run deploy:staging` and `npm run deploy:production` to `package.json`
- Added Section 14 "Deployment Workflow" to `CLAUDE.md`
- First real PR (#1) created and merged staging → main to verify the workflow
- Pushed `staging` branch — Vercel Preview built successfully (● Ready)

### Performance improvements (committed earlier in session)
- **Cursor pagination** on customers list (`useInfiniteQuery`, 50/page, "טען עוד" button)
- **API response limits** capped: appointments/leads/payments/pets/tasks 500 → 200
- **`take` guard** added to training-packages, availability, blocks, task-recurrence APIs
- **Next.js Image component** everywhere: sidebar, booking page, owner shell, tenant admin shell
- **Dynamic imports** on dashboard: `RevenueChart` extracted to `src/components/dashboard/RevenueChart.tsx` and lazy-loaded; order modal + onboarding modal also lazy
- **`next.config.mjs`**: `images.remotePatterns` allows any HTTPS host
- **`docs/PERFORMANCE.md`** created: full performance guide (lazy loading, pagination, caching, DB indexes)

### Generated comprehensive CLAUDE.md
- Full rewrite from scratch by reading actual code — 14 sections, 1000+ lines
- Covers: tech stack, all 50+ DB models, feature map with statuses (✅/🔄/❌), conventions, deployment workflow

---

## 2. What's Working

- All existing app features unchanged and live in production
- Production at latest commit `9c8d4f8` ✅
- TypeScript: clean, zero errors
- Customers page: cursor pagination (50/page, "טען עוד" loads next page)
- Dashboard: lazy-loaded charts and modals (faster initial paint)
- `npm run deploy:staging` → merges current branch → staging → Vercel Preview builds automatically
- `npm run deploy:production` → opens PR staging → main → manual approval → merge → production deploy
- Branch protection on `main` active — direct `git push origin main` blocked

---

## 3. What's Broken or Incomplete

**Staging URL is not permanent**
Vercel gives a new random URL on every staging push. No permanent staging domain configured yet. Each push requires finding the new URL in the Vercel dashboard.

**Staging shares the same Supabase DB as production**
No separate DB for staging. Any schema migration tested on staging runs against production data.

**Solo developer PR approval**
GitHub won't let you approve your own PR. Workaround: `gh pr merge --admin`. This means branch protection only guards against accidental pushes to main, not deliberate bypasses.

**RESEND_API_KEY not set**
Email delivery (forgot password, appointment reminders) silently fails. `RESEND_API_KEY=""` in both `.env` and Vercel.

**`/intake` middleware bug**
Dashboard admin page `/intake` is accessible without authentication — middleware prefix-matches `/intake/[token]` (public form), which also passes `/intake` itself.

**Cron jobs defined but unverified**
`vercel.json` has 4 cron jobs. Never confirmed they actually fire. Requires `CRON_SECRET` in Vercel env vars.

**`dev` branch unused**
All commits this session went directly to `main`. The `dev` branch exists but has no unique commits.

---

## 4. Exact Stopping Point

Last action: pushed to `staging` to demonstrate the deployment workflow. Vercel Preview built successfully.

- Current branch: `main`
- Working tree: clean (nothing uncommitted)
- Local = origin/main: fully synced
- Latest commit on main: `9c8d4f8` — "docs: add PERFORMANCE.md and update CLAUDE.md"

---

## 5. Next Step — First Thing to Do Next Session

**Set a permanent staging URL on Vercel (5 minutes):**

1. Go to: `vercel.com/alldogneed-9395s-projects/petra-app/settings/domains`
2. Click "Add Domain"
3. Enter: `staging-petra.vercel.app` (or any name you prefer)
4. When asked which branch → select `staging`
5. Save — same URL every push to staging from now on

**Then start using `dev` branch for daily work:**
```bash
git checkout dev
git merge main     # sync with latest
git push origin dev
# all future work starts here, not on main
```

---

## 6. Open Questions

1. **Permanent staging domain** — `vercel.app` alias or a real custom subdomain like `staging.petra-app.com`?

2. **Separate Supabase for staging** — low risk now (no other users), but needed before any destructive migrations. When to set up?

3. **GitHub Pro vs public repo** — repo is now public. Long-term plan? GitHub Pro is $4/mo for private repo + branch protection.

4. **Cron jobs actually running?** — check Vercel dashboard → Cron tab. If `CRON_SECRET` isn't set in Vercel, all 4 cron routes return 401 silently and nothing runs.

5. **Customers search after pagination** — search runs client-side against the first 50 loaded records only. Businesses with 200+ customers will get incomplete search results. Needs server-side search (`?search=` param on the API).

6. **GoalSection toggle** — marking a goal complete: unverified whether it invalidates `training-programs-service` query key. Only confirmed the "add goal" path was fixed. Should be tested with a service dog training program.

---

## 7. Files Changed This Session

### New Files
| File | Purpose |
|------|---------|
| `scripts/deploy.sh` | Deploy helper (staging + production modes) |
| `scripts/DEPLOY_CHECKLIST.md` | Pre-deploy checklist |
| `src/lib/env.ts` | Typed server-side env config |
| `.env.example` | Safe-to-commit env template |
| `docs/PERFORMANCE.md` | Performance guide (lazy loading, pagination, caching, images, DB) |
| `src/components/dashboard/RevenueChart.tsx` | Extracted from dashboard for lazy loading |
| `HANDOFF.md` | This file |

### Modified Files
| File | Change |
|------|--------|
| `package.json` | +`deploy:staging`, +`deploy:production` scripts |
| `CLAUDE.md` | Full rewrite — 14 sections, 1000+ lines |
| `vercel.json` | +staging in `deploymentEnabled`, +4 cron job definitions |
| `next.config.mjs` | +`images.remotePatterns` for any HTTPS host |
| `.gitignore` | Minor cleanup |
| `src/app/(dashboard)/customers/page.tsx` | Cursor pagination with `useInfiniteQuery` + "טען עוד" button |
| `src/app/(dashboard)/dashboard/page.tsx` | Dynamic imports for RevenueChart + modals |
| `src/app/api/customers/route.ts` | Cursor-based pagination (cursor + take=50) |
| `src/app/api/appointments/route.ts` | `take: 200` cap |
| `src/app/api/leads/route.ts` | `take: 200` cap |
| `src/app/api/payments/route.ts` | `take: 200` cap |
| `src/app/api/pets/route.ts` | `take: 200` cap |
| `src/app/api/tasks/route.ts` | `take: 200` cap |
| `src/app/api/training-packages/route.ts` | `take: 100` guard |
| `src/app/api/booking/availability/route.ts` | `take` guard |
| `src/app/api/booking/blocks/route.ts` | `take` guard |
| `src/app/api/task-recurrence/route.ts` | `take` guard |
| `src/components/layout/sidebar.tsx` | `img` → Next.js `Image` |
| `src/components/owner/owner-shell.tsx` | `img` → Next.js `Image` |
| `src/components/tenant-admin/tenant-admin-shell.tsx` | `img` → Next.js `Image` |
| `src/app/book/[businessId]/page.tsx` | Logo `img` → Next.js `Image` |

---

## Production Status

| Item | Status |
|------|--------|
| Latest commit | `9c8d4f8` |
| Production (main) | ✅ Deployed |
| Staging | ✅ Preview ready |
| TypeScript | ✅ Clean |
| Git | `main` = `origin/main` (fully synced) |
| Branch protection | ✅ Active on `main` |
| Repo visibility | Public (github.com/alldogneed/petra-app) |
