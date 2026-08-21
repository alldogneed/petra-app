---
name: petra-mcp-dev-workflow
description: End-to-end delivery workflow for Petra features that must ship to production safely — especially MCP tool packages (src/lib/mcp/*, /api/mcp). Use when asked to "add MCP tools", "build package N", "ship to prod", "do a security check and live test", or to develop a multi-file feature with subagents. Covers spec → clean worktree from origin/main → parallel implementation subagents (one file each) → scoped tsc (full tsc stalls on this machine) → Vercel build gate → read-only security-review subagent → fixes → fast-forward push to main → live E2E on the QA business (qa-test@petra.local) → red-team → memory/CLAUDE.md sync. Do NOT use for UI-only tweaks or docs.
---

# Petra dev workflow (MCP packages & prod-bound features)

Battle-tested 2026-08-21 across 5 MCP packages (20 → 63 tools), 4 security reviews, 1 prod red-team. Follow the phases in order; each has a gate. Skipping a gate is how regressions reached prod (see Gotchas).

## Phase 0 — Scout + spec (inline, 10 min)
1. `git fetch origin main`; inventory the service functions you will call: `grep -n "^export async function" src/services/<domain>.ts`, model fields in `prisma/schema.prisma`, and the UI route that does the same thing (`src/app/api/<domain>/route.ts`) — MCP tools must mirror its validation, tier gates and side effects (reminders, GCal, invoicing).
2. Write/refresh the shared spec file the subagents will read: copy `references/mcp-tool-spec.md` from this skill into the session scratchpad and fill in worktree path, branch, new scopes, module names. The spec is the contract: mandatory tool pattern, `idempotency_key` + `dry_run` on every write, id-only audit summaries, entity id FIRST in replies, `safeField`/`heDate`/`parseYmd`, tenant scoping.

## Phase 1 — Clean worktree + scaffold (inline)
```bash
WT=<scratchpad>/wt-<pkg>; git worktree add "$WT" -b feature/<pkg> origin/main
ln -sfn "$(pwd)/node_modules" "$WT/node_modules"      # never npm install in the worktree
```
Never build on `feature/workshops-ops` or the main repo working tree — it carries unrelated uncommitted work. In the worktree: add scopes to `DEFAULT_MCP_SCOPES` (src/lib/mcp-auth.ts) and extend the exact-set grandfather list in `effectiveScopes()` (route.ts) with the previous default set; create `src/lib/mcp/tools-<name>.ts` stubs exporting `register<Name>Tools(server, ctx)`; register them in `buildServer()` in route.ts. Commit nothing yet.

## Phase 2 — Parallel implementation subagents
- One `general-purpose` agent per FILE (tools-<a>.ts, tools-<b>.ts, route.ts edits, UI file). Prompt = "read the spec first" + exact tool list (name, scope, params, service to call, side effects to mirror) + "your file ONLY" + "run the parse check + re-verify every signature you used (quote file:line) + final report". Tell them what other agents own so they don't collide.
- Agents can die on usage limits; their work is NOT saved until they write files. On failure: check disk (`wc -l`, `grep -c "server.tool("`), then `SendMessage` to the same agent id with "redo from the start" — it keeps its context.
- When one agent must consume another's export (e.g. `findAppointmentConflicts`), name the exact signature in both prompts and tell the consumer to add a local fallback if the export is missing at the end.

## Phase 3 — Typecheck (scoped tsc only)
Full `tsc --noEmit` stalls at 0% CPU (iCloud-evicted files under node_modules; mirrors don't help). Use a scoped tsconfig in the worktree:
```bash
cat > tsconfig.scoped.json <<'EOF'
{ "extends": "./tsconfig.json", "compilerOptions": { "incremental": false, "noEmit": true, "skipLibCheck": true }, "include": [], "files": ["src/app/api/mcp/route.ts","src/lib/mcp/helpers.ts","src/lib/mcp/tools-<x>.ts", "…every file you touched…"] }
EOF
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc -p tsconfig.scoped.json > ../tsc.log 2>&1; rm tsconfig.scoped.json
grep "error TS" ../tsc.log | grep -v whatsAppMessageLog      # that one error is a stale prisma client — pre-existing, ignore
```
Gate: 0 relevant errors. Also run `node scripts/audit-route-auth.mjs` if you added/changed API routes (it is part of the Vercel build).

## Phase 4 — Commit, branch build, review (parallel)
1. Commit in the worktree with `-c user.name="Or Rabinovich" -c user.email="or.rabinovich@gmail.com"`, descriptive message + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; `git push -u origin feature/<pkg>`.
2. Poll the Vercel build (foreground loop ≤9 min; background shell pollers on this machine die after the first iteration):
   `gh api repos/alldogneed/petra-app/commits/<sha>/status --jq '.state'` → `success` | `failure`.
3. In parallel spawn the READ-ONLY security-review agent (prompt template in `references/review-prompt.md`): tenant isolation per tool, scope-first, idempotency before writes, dry_run writes nothing, side effects mirrored + awaited, PII in audit params/summaries, input bounds, type risks → verdict SAFE-TO-SHIP / SHIP-WITH-FIXES / DO-NOT-SHIP.
4. Apply fixes with a python patch script that asserts `s.count(old) == expected` per replacement, then re-run scoped tsc. **Never chain `… && git push` after a python patch in the same command without checking its exit code** — a failed assert once let an unpatched commit reach main.

## Phase 5 — Ship to main
```bash
git fetch origin main && git merge-base --is-ancestor origin/main HEAD && git push origin feature/<pkg> HEAD:main
```
Other sessions push to main concurrently (PRs #26/#27 landed mid-session) — if not fast-forward, rebase first. Vercel prod builds sometimes sit 30–40 min in "Checking validity of types" and then go READY; branch builds are 5 min. Wait for prod by polling the live tool count:
`tools/list` via a freshly minted READ-ONLY QA token until `result.tools.length == <expected>`, then revoke that token.

## Phase 6 — Live E2E on QA (mandatory before declaring done)
- QA business only: `qa-test@petra.local` (password in memory `reference-qa-test-business` / session scratchpad `test-user-creds.txt`), businessId `aa4f5cee-…`, free tier (boarding CREATE and `send_reminder` are correctly tier-gated there → count as expected). Never test on real customer businesses.
- Copy `references/live-test-template.sh`, add one block per new tool: dry_run → real → replay (♻️) → foreign-id rejected → RO token denied for writes → list/get reflects the write. Mint RW + RO tokens at start, revoke both at the end. Grab ids with `grep -o 'id: [0-9a-f-]\{36\}' | head -1` — so reply text must put the created entity id first.
- Interpret failures before fixing code: most ❌ in this session were script artifacts (wrong id captured, product logic like DHPP = last date + 365d, briefing date after update_lead moved the follow-up). Re-run after fixing the script.
- For security-sensitive packages also spawn the red-team agent (`references/redteam-prompt.md`): IDOR with known foreign ids, RO scope on every write tool, auth/limiter probes (≤40 parallel — 110 parallel once saturated the DB pooler and caused 500s), prompt-injection strings, idempotency abuse, audit PII. It must revoke its connections at the end.

## Phase 7 — Close out
- Sync the main repo working tree so the next session isn't confused: `git diff <base> <head> > p.patch` in the worktree, `git apply p.patch` in the main repo (exclude files the workshops branch changed, e.g. McpConnectionsTab.tsx); `git worktree remove --force $WT`.
- Update CLAUDE.md MCP section (tool count + new modules/scopes) in the same commit as the feature, and write a memory file (what shipped, commits, live-test result, open items) + MEMORY.md pointer.
- Report: what shipped (commits), verification evidence (tsc, build, review verdict, live N/N), what is still open and what needs the user (e.g. Vercel env, QA tier upgrade).

## Gotchas (all hit in practice)
- **Never write credentials into repo files** (skills, templates, docs). Keep the QA password only in the session scratchpad / memory pointer; grep for it before every commit (`grep -rn '<pw>' .claude docs`). A template once carried it to a public commit and forced a rotation.
- Bash chains: a failed `python3 - <<EOF` patch does NOT stop `&& git push` later in the same command unless you check `$?` — put `if [ $? -ne 0 ]; then exit 1; fi` (or `set -e`) before any commit/push step.
- `git` prints `object directory /private/tmp/petra-objdir does not exist` — harmless alternates warning; `grep -v petra-objdir`.
- Edit/Write tools can turn ` `-style escapes into raw control bytes → file becomes "binary"; build regexes with `String.fromCharCode` or use python byte patches; `grep -nP '[\x00-\x08\x0b\x0c\x0e-\x1f]'` to verify.
- Supabase MCP `execute_sql` writes and admin logins are classifier-blocked in auto mode; ask the user for QA tier/env changes.
- Vercel MCP tools: `list_deployments` needs `projectId prj_wzZjjUtcerJwTo0dUgbFtvaPlAyU` + `teamId team_St4dFT8fDNopaeGXTwmXBg4d`; `get_runtime_logs` needs `level` as an array and a `since` in the past (server clock is UTC); responses can exceed the token cap — grep the saved tool-results file.
- Upstash Redis was dead (ENOTFOUND) → all rate limiting is per-lambda memory; `/api/mcp` has a DB-backed burst guard (McpAuditLog count). Until the user recreates Upstash, parallel bursts are not capped.
- Audit `resultSummary` must stay id-only; `redactParams` covers `PII_PARAM_KEYS` only — add new PII-ish param names there.
- New tools that `findFirst` then `update/delete` must use `where: { id, businessId }` (Prisma 5 extended where-unique) — the pattern every service uses.
