# Petra App — Session Handoff (2026-03-07, Session 2)

---

## 1. What We Did Today

### 3-Environment Workflow Setup
- Created `src/lib/env.ts` — typed, server-only env validator. `DATABASE_URL` + `DIRECT_URL` are **required** (throw at startup if missing). All other vars are `optional()` with defaults. Has `isDev`, `isStaging`, `isProd` helpers.
- Created `.env.example` — safe-to-commit template for all env vars
- Created `.env.staging` + `.env.production` — gitignored templates with instructions
- Updated `vercel.json` — added `git.deploymentEnabled.staging: true` so Vercel auto-deploys the staging branch
- Created `scripts/deploy.sh` — `npm run deploy:staging` merges current branch → staging and pushes; `npm run deploy:production` opens a GitHub PR from staging → main (requires approval)
- Created `scripts/DEPLOY_CHECKLIST.md` — pre-deploy checklist
- Updated `CLAUDE.md` sections 5, 15, 16 — env.ts usage, Supabase setup guide, initial git setup + daily workflow

### Staging Database
- Used Vercel's built-in Neon database (already connected via storage integration) for staging
- Set `DATABASE_URL` + `DIRECT_URL` in Vercel for Preview/staging branch → Neon pooler + direct URLs
- Applied full Prisma schema to Neon: `prisma db push --schema=prisma/schema.production.prisma --accept-data-loss`

### Deployed + PR Workflow Validated
- Pushed to staging branch → Vercel built ✅ Ready
- Opened PR #2 (staging → main) via `npm run deploy:production`
- PR #2 merged → production build ✅ Ready
- Full cycle tested and working end-to-end

### Performance Improvements (committed alongside, from uncommitted local changes)
- **Customers page**: refactored from `useQuery` → `useInfiniteQuery` with cursor-based pagination (50/page, "טען עוד לקוחות" button). API now returns `{ customers, nextCursor, hasMore }` instead of a flat array.
- **API limits reduced**: appointments/leads/payments/pets/tasks `take: 500` → `take: 200`; training-packages/availability/blocks/task-recurrence had no limit → added `take: 100–200`
- **`next.config.mjs`**: added `images.remotePatterns` (any HTTPS host) so Next.js `<Image>` works for external logos/photos
- **`<img>` → `<Image>`**: sidebar, login page, booking page, WelcomeScreen, WhatNextScreen, OwnerShell, TenantAdminShell
- **Dashboard**: moved `RevenueChart` out to `src/components/dashboard/RevenueChart.tsx` (dynamic import). Also lazily loads onboarding modals and CreateOrderModal.

---

## 2. What's Working

- **3-environment workflow**: staging auto-deploys on push, production requires PR approval. `npm run deploy:staging` + `npm run deploy:production` both work.
- **Staging DB**: Neon database has full schema, staging Vercel deployments have `DATABASE_URL`/`DIRECT_URL` set
- **Production DB**: Supabase `ipeshpbikcfcwkvkztxn` (ap-northeast-2), unchanged, working
- **Customers infinite scroll**: loads 50/page with "Load More" button, client-side status/financial/tag filtering still works across all loaded pages
- **Image optimization**: all `<img>` tags converted to Next.js `<Image>`, `next.config.mjs` allows any HTTPS host
- **TypeScript**: build passes (Vercel deployment succeeded)
- **Production**: `petra-app.com` live, last commit `9c8d4f8`
- **Git branches**: `main` (protected, PR-only), `staging` (auto-deploy), `dev` (local)

---

## 3. What's Broken or Incomplete

- **`RESEND_API_KEY` not set in Vercel**: forgot-password emails and reminder emails don't send. Needs account at resend.com → set in Vercel Production + Preview env vars.
- **`/intake` middleware bug**: `/intake` (dashboard admin page) is publicly accessible because `PUBLIC_PATHS` in `middleware.ts` uses prefix matching. Known bug, not fixed this session.
- **Staging APP_URL wrong**: set to `https://petra-app.com` for ALL preview environments (blanket Preview var). This means `env.isStaging` returns `false` on staging, and any email links in staging will point to production. Fix: set APP_URL for staging branch specifically in Vercel.
- **Local main has 4 extra commits**: `d6363c6`, `ea42cd5`, `08f3874`, `47ea438` exist locally but not on `origin/main` (push was blocked by branch protection). All 4 are already in production via PR #2. Safe to `git reset --hard origin/main`.

---

## 4. Exact Stopping Point

Last action: merged PR #2 (staging → main), confirmed production ✅ Ready. Updated MEMORY.md. All code is in production. HANDOFF.md being written now.

---

## 5. Next Step — First Thing to Do Next Session

**Set `RESEND_API_KEY` so email works:**
```bash
# 1. Go to resend.com → sign in → API Keys → Create API Key (free tier)
# 2. Copy the key, then run:
vercel env add RESEND_API_KEY production   # paste key when prompted
vercel env add RESEND_API_KEY preview      # same key for staging
# 3. Redeploy:
npm run deploy:staging && npm run deploy:production
# → merge the PR → Vercel redeploys with the key set
```
This unblocks: forgot-password, birthday reminders, vaccination reminders, appointment reminders.

**Then clean up local main:**
```bash
git fetch origin && git reset --hard origin/main
```

---

## 6. Open Questions

1. **Staging APP_URL**: needs to be set to the actual Vercel staging URL so `env.isStaging` works and email links go to staging. Find the URL: Vercel dashboard → Deployments → filter by "staging" branch → copy the URL. Then: `vercel env add APP_URL preview staging` + `vercel env add NEXT_PUBLIC_APP_URL preview staging`.

2. **Neon staging DB schema sync**: whenever `prisma/schema.prisma` changes, both production (Supabase) and staging (Neon) need the schema applied. For staging, run:
   ```bash
   DATABASE_URL="<neon-pooler-url>" DIRECT_URL="<neon-direct-url>" \
     PATH="/Users/or-rabinovich/local/node/bin:$PATH" \
     npx prisma db push --schema=prisma/schema.production.prisma
   ```
   The Neon URLs are in `.env.vercel-temp` or in Vercel env pull for development.

3. **Customers `useInfiniteQuery` and server-side filtering**: client-side filters (status, financial, tags) currently apply only to loaded pages. For businesses with 500+ customers, the "debt" filter will miss customers not yet loaded. Consider adding server-side filter params to the enhanced API.

4. **Cron jobs**: birthday/vaccination/appointment reminders are scheduled in `vercel.json` and coded, but won't send until `RESEND_API_KEY` is set. WhatsApp reminders also need `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`.

5. **Local main state**: 4 local commits exist that are not on `origin/main`. They ARE in production (via PR). Running `git reset --hard origin/main` is safe and recommended to keep local in sync.

---

## 7. Files Changed This Session

### New Files
| File | What |
|------|------|
| `src/lib/env.ts` | Typed server-side env validator with required/optional helpers |
| `.env.example` | Safe-to-commit template for all env vars |
| `scripts/deploy.sh` | Deploy automation: staging merge + production PR |
| `scripts/DEPLOY_CHECKLIST.md` | Pre-deploy checklist |
| `src/components/dashboard/RevenueChart.tsx` | Extracted from dashboard/page.tsx for dynamic import |
| `docs/PERFORMANCE.md` | Performance guide (lazy loading, pagination, caching, DB indexes) |

### Modified Files
| File | Change Summary |
|------|----------------|
| `CLAUDE.md` | Added sections 15 (Supabase setup), 16 (git setup + daily workflow); updated section 5 (env.ts usage); Performance Conventions |
| `vercel.json` | Added `git.deploymentEnabled.staging: true` |
| `.gitignore` | Added `.env.staging`, `.env.production` |
| `next.config.mjs` | Added `images.remotePatterns` (any HTTPS), `dangerouslyAllowSVG: true` |
| `src/app/(dashboard)/customers/page.tsx` | `useQuery` → `useInfiniteQuery` with cursor pagination + "Load More"; updated `EnhancedCustomer` interface |
| `src/app/(dashboard)/dashboard/page.tsx` | Dynamic imports for RevenueChart, onboarding modals, CreateOrderModal |
| `src/app/api/customers/route.ts` | Cursor pagination, `{customers, nextCursor, hasMore}` response, `source` field restored |
| `src/app/api/appointments/route.ts` | `take: 500` → `take: 200` |
| `src/app/api/leads/route.ts` | `take: 500` → `take: 200` |
| `src/app/api/payments/route.ts` | `take: 500` → `take: 200` |
| `src/app/api/pets/route.ts` | `take: 500` → `take: 200` |
| `src/app/api/tasks/route.ts` | `take: 500` → `take: 200` |
| `src/app/api/training-packages/route.ts` | Added `take: 100` |
| `src/app/api/booking/availability/route.ts` | Added `take: 100` |
| `src/app/api/booking/blocks/route.ts` | Added `take: 200` |
| `src/app/api/task-recurrence/route.ts` | Added `take: 100` |
| `src/app/book/[slug]/page.tsx` | `<img>` → `<Image>` for business logo |
| `src/app/login/page.tsx` | `<img>` → `<Image>` for logo |
| `src/components/layout/sidebar.tsx` | `<img>` → `<Image>` for logo |
| `src/components/onboarding/WelcomeScreen.tsx` | `<img>` → `<Image>` |
| `src/components/onboarding/WhatNextScreen.tsx` | `<img>` → `<Image>` |
| `src/components/owner/owner-shell.tsx` | `<img>` → `<Image>` |
| `src/components/tenant-admin/tenant-admin-shell.tsx` | `<img>` → `<Image>` |

---

## Production Status
- **Last deploy**: `9c8d4f8` — ✅ Ready on `petra-app.com`
- **Staging**: `47ea438` — ✅ Ready on Vercel preview URL
- **TypeScript**: ✅ clean (build passes)
- **Git**: `origin/main` at `9c8d4f8`. Local main has 4 extra commits (already in prod via PR) — safe to reset.
- **Open PRs**: none
