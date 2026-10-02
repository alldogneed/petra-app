---
name: petra-feature-delivery
description: End-to-end delivery of a multi-file Petra feature from a cloud (claude.ai/code) session — scout & verify claims against code AND data, foundation commit, file-disjoint parallel subagents, local Postgres + production-build QA (API script + Playwright), read-only security review, fixes, merge main, additive prod DDL, PR → production, live checks, CLAUDE.md sync. Use when the user asks to "build/implement it all", "תעשה את הכל", "QA בלוקל", "אבטחה", "בדיקה חיה", "פרודקשן", "תעבוד עם תתי סוכנים", or to ship a feature touching API + UI + schema. For MCP tool packages use petra-mcp-dev-workflow (Mac-local) — this skill is the cloud-container counterpart. Not for one-file tweaks or docs.
---

# Petra feature delivery (cloud session, subagents, prod)

Born 2026-10-01 shipping the "ניהול ובקרה" control center (PR #79: 7 tabs, ~150 files, 7 subagents,
61/61 API QA, security review → fixes). Living document — when a phase bites you, add the lesson
to **Gotchas** in the same PR.

Phases are gated. Don't skip a gate; don't report done before the last one.

## Phase 0 — Scout, and verify every claim (inline)
1. Read CLAUDE.md + the target module. Map: page/components, API routes, services, models.
2. **Before telling the user "X is missing/broken", prove it twice: in code (grep all call paths,
   incl. `logCurrentUserActivity`-style wrappers) AND in data** (local DB, or one read-only prod
   aggregate if allowed). A recommendation once claimed creates weren't logged — they were, via a
   wrapper; prod counts showed it. Correct mistaken claims to the user explicitly.
3. Existing infra first: e.g. `permissionOverrides` + `CRITICAL_CAPABILITIES` already existed — the
   job was enforcement, not a new system.

## Phase 1 — Environment (inline, ~5 min)
```bash
npm ci --no-audit --no-fund                       # background it
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER petra WITH PASSWORD 'petra' SUPERUSER;" -c "CREATE DATABASE petra OWNER petra;"
# .env (gitignored): DATABASE_URL=DIRECT_URL=postgresql://petra:petra@localhost:5432/petra, APP_URL/NEXT_PUBLIC_APP_URL=http://localhost:3000, GCAL_ENCRYPTION_KEY=<64 hex>, CRON_SECRET=x
npx prisma db push
set -a; . ./.env; set +a; npm run db:seed && npm run db:seed-admin   # owner@petra.local / Admin1234! (seed defaults)
```
Add QA fixtures with SQL: a staff member in `demo-business-001` and a SECOND business with its own
owner + a customer (cross-tenant tests). Full `npx tsc --noEmit` works here (~1 min) — no scoped tsc needed.

## Phase 2 — Foundation commit (inline, before any agent)
- Schema changes (additive, nullable) + `cp prisma/schema.prisma prisma/schema.production.prisma`
  + `prisma/<feature>.sql` (`ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). Verify with
  `prisma db execute --file` locally then `prisma migrate diff --from-url $DIRECT_URL --to-schema-datamodel prisma/schema.prisma` → empty.
- Shared client-safe catalog libs (names, labels, helpers) that agents import but may NOT edit.
- **Split big files so agents never share a file** (e.g. a 1300-line page → `src/components/<area>/<Tab>.tsx`
  + shared.tsx; page.tsx keeps only shell + TABS, owned by the lead). Do it with a python script, then tsc.
- Stubs for cross-package hooks (e.g. `security-alerts.ts` exporting a no-op the logger already calls).
- tsc clean → commit → push the feature branch.

## Phase 3 — Parallel subagents
- Copy `references/spec-template.md` to the scratchpad, fill "What already exists". Every agent
  reads it first.
- One `general-purpose` background agent per package with an explicit **OWN list** of files;
  "everything else: report under Requests for other files". Typical split: (A) cross-cutting route
  edits, (B..E) one feature area each = service + route(s) + pure lib + jest test + its UI tab.
- Each prompt: exact API contract wanted, tenant/auth rules, what to verify (tsc, jest, route audit,
  lint on own files, a smoke run of the service against local DB), final report format.
- Ask at least one agent for a **read-only audit** of something adjacent (e.g. "which permissions are
  actually enforced, file:line") — it produced the most valuable follow-up package.
- As reports land: apply "Requests for other files" yourself (small) or spawn a follow-up package
  once the owning agent is done. Never let two live agents own the same file.
- The stop hook demands commit+push while agents run: WIP commits on the feature branch are fine.

## Phase 4 — Integrate + local QA
1. Wire new tabs/components in the lead-owned files; `npx tsc --noEmit -p tsconfig.json`; `npx jest src/lib`;
   `node scripts/audit-route-auth.mjs`.
2. **Production build, not dev**: `set -a; . ./.env; set +a; npm run build && npx next start -p 3000`
   (dev mode's CSP blocks `eval` → React never hydrates under Playwright).
3. **API QA** — adapt `scripts/api-qa.example.sh` (curl + cookie jars for owner / staff / other-business
   owner): happy paths, validation 400s, non-owner 403s, cross-tenant 404/empty, pagination, export file
   type, permission toggle → 403, side effects in DB via psql. Use unique data per run (random phone).
4. **UI QA** — `scripts/ui-qa.js` (Playwright from global node-tools; logs in through the form;
   clicks every tab desktop 1400 + mobile 390; fails on console errors, `/api/<area>` ≥400 and
   horizontal overflow; screenshots to look at). Run it BEFORE the API script or restart the server —
   the login limiter is in-memory and the API script burns logins (429).
5. Interpret ❌ before fixing code: most were script artifacts (201 vs 200, wrong row picked, duplicate
   phone 409, missing `x-confirm-action` header → 428). Real ones found here: 30s session cache made
   permission revokes lag → invalidate on change.

## Phase 5 — Security review + fixes
Spawn `references/security-review-prompt.md` (read-only) once code is final. Fix every MEDIUM+, most
LOWs; re-run tsc/jest/build/API QA. Patch with python scripts that `assert s.count(old)==1` and check
`$?` before any commit/push.

## Phase 6 — Ship
1. `git fetch origin main`; if moved → `git merge origin/main` (resolve CLAUDE.md rule-number
   collisions by renumbering yours), re-run tsc + jest + build + API QA.
2. Prod DDL first: Supabase MCP `apply_migration` with the additive SQL (old code ignores new columns).
3. Open the PR (`mcp__github__create_pull_request`, body per repo conventions). **Merging to main =
   production deploy. The auto-mode classifier blocks deploy steps and prod reads unless the user
   explicitly approved them in this session — ask the user, quoting what will ship, then merge.**
4. Before merging, re-check `mergeable_state` (`mcp__github__pull_request_read get`): other sessions
   merge to main constantly (it moved TWICE during PR #79). "dirty" → merge origin/main again, re-run
   tsc + jest + build + API QA, push, wait for the preview status = success, then
   `merge_pull_request` with `expectedHeadSha`.
5. Wait for Vercel prod READY (`mcp__Vercel__list_deployments` projectId `prj_wzZjjUtcerJwTo0dUgbFtvaPlAyU`,
   teamId `team_St4dFT8fDNopaeGXTwmXBg4d`, target production). PR #79: preview ~5 min, prod ~10 min.
   Wait with a background `sleep N` Bash (foreground sleep is blocked), then re-check.
6. Live checks: unauthenticated probes of every new route (401/403, never 500); `get_runtime_errors` /
   runtime logs for the new deployment id (`get_runtime_logs` level ["error","fatal"]); with user-provided QA credentials (never stored in repo) run the UI
   script against `https://petra-app.com` on the QA business only.

## Phase 7 — Close out
CLAUDE.md rules for the new invariants (same PR), task list closed, report to the user in Hebrew:
what shipped, evidence (numbers), behaviour changes per role, what needs them (approvals, env, data
checks), corrections to anything you said earlier.

## Gotchas (all hit in practice)
- The auto-mode classifier blocks prod DB reads ("Production Reads") and anything heading to a deploy
  ("Production Deploy" — even a `git fetch` + ancestry check right before the merge). Don't route
  around it: open the PR, ask the user with AskUserQuestion (deploy approval + whether to do an
  authenticated live test), then merge. `apply_migration` for additive DDL was allowed.
- After a merged PR, follow-up work restarts the same branch from origin/main (`git checkout -B <branch> origin/main`).
- Merge conflicts in a file another PR rewrote (e.g. analytics page in #78): take theirs, then
  re-apply only your intent — and check whether it's still needed (the page had become owner-only).
- `pkill -f "next …"` matches your own bash command line and kills the shell (exit 144) — kill by PID
  from `ps aux | grep next-server`.
- Write/Edit tools turn `\u0000`-style escapes in regex literals into raw control bytes → TS1161.
  Patch with python using escaped strings; check `grep -cP '[\x00-\x08\x0b\x0c\x0e-\x1f]' file` = 0.
- Prisma drops `undefined` in `where` → a `deleteMany` with an undefined id wipes all tenants. A
  pending-approval executor on main did exactly this; use a throwing `payloadId()` helper.
- `hasTenantPermission(role, PERM)` without overrides silently ignores the owner's matrix — use
  `requireBusinessPermission` / `sessionHasTenantPermission`.
- AdminSession is platform-wide: "revoke a member's session" can log them out of another business
  they own — restrict to active, non-owner, non-platform members who own nothing else.
- Session cache is 30s per instance: invalidate (`invalidateUserSessionCache`) after role/permission
  changes; cross-instance lag stays ≤30s.
- Awaited side effects in request paths (alerts) need a timeout (`Promise.race`, clear the timer).
- jest/ts-jest were missing from devDependencies (config existed) — now installed.
- `booking-engine` / `order-calc` jest suites fail on main — not yours; check with a worktree of
  `origin/main` before blaming the branch.
- The full-page Playwright screenshot shows the off-screen "לקוח חדש" bottom sheet — artifact.
