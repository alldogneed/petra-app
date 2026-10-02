# Spec — <FEATURE NAME>

Repo: <REPO PATH> (branch <BRANCH>). Work DIRECTLY in this tree.
Several agents work in parallel on DISJOINT files. Edit ONLY the files your package owns
(listed in your prompt). If you need a change in a file you don't own, put it in your final
report under "Requests for other files" — do not edit it.
Do NOT commit, do NOT push, do NOT run `prisma db push`/migrations, do NOT touch any remote DB.
Never query production (Supabase/Vercel). Local Postgres only (DATABASE_URL in .env = localhost).

Read first: /home/user/petra-app/CLAUDE.md (critical rules), docs/service-layer.md.

## What already exists (foundation, committed by the lead)
<!-- FILL IN: schema fields added (+ prisma generate done), new shared libs with their exports,
     component split (which file each tab/section lives in), stubs other packages implement.
     Agents may NOT edit foundation files — they report needed changes instead. -->

## Global rules (all packages)
1. Auth for every new/changed route: use the right guard (owner-only screens: see
   `src/app/api/business-admin/overview/route.ts`; capability gates: `requireBusinessPermission` /
   `sessionHasTenantPermission` WITH overrides — CLAUDE.md rule on the permission matrix), businessId from session
   ONLY (never from body/query). Mirror the existing pattern in
   `src/app/api/business-admin/overview/route.ts` (requireAuth + getCurrentUser, `businessRole ===
   "owner"`), or a stricter helper from `src/lib/auth-guards.ts` if one fits. Check
   `scripts/audit-route-auth.mjs` rules and make sure new routes pass `node scripts/audit-route-auth.mjs`.
   Platform-admin impersonation must keep working the same way as the existing routes.

2. Tenant isolation: every query filters by businessId (directly or via a relation such as
   `connection: { businessId }`). Any id coming from the client (sessionId, memberId…) must be
   verified to belong to this business before use. Use `where: { id, businessId }` patterns.
3. If you read ActivityLog: rows for a business = `businessId = X` OR (legacy) `businessId IS NULL AND userId IN
   (members of X)`. Use exactly this legacy-fallback rule wherever you read ActivityLog for a business.
4. Dates/periods are Israel time (Asia/Jerusalem). There's a helper in
   `src/lib/mcp/helpers.ts` (`israelStartOfToday`) — reuse it or write a small pure helper in your
   own new lib file. Never `new Date(y, m, d)` on the server for "today"/"this month".
5. Services: business logic in `src/services/*` (see docs/service-layer.md, ServiceError codes);
   routes do auth + call service + map errors. Prisma import: `import prisma from "@/lib/prisma"`.
6. UI: Hebrew, RTL, Tailwind, existing classes (`.card`, `.btn-primary`, `.btn-secondary`, `.input`,
   `.label`), sonner toasts, React Query with invalidateQueries. Loading = `<PetraLoader />`
   (`variant="inline"` inside cards) — NO skeletons/spinners (CLAUDE.md rule 29). Mobile-friendly
   (tables collapse / horizontal scroll), no horizontal page overflow.
7. Output hygiene: customer-controlled strings shown as React text only (no dangerouslySetInnerHTML);
   in emails escape HTML. Never return secrets/tokens/password hashes/raw session tokens.
   Never return `AdminSession.token` to the client.
8. Bounded inputs: clamp `take` (≤100), validate dates, cap search strings (≤100 chars), validate
   enums against allowlists.
9. Tests: pure logic goes in a small pure module with jest tests under `src/lib/__tests__/`
   (see existing tests there; run `npx jest <path>` — jest/ts-jest are devDependencies).
   `booking-engine` + `order-calc` suites fail on main already — ignore them.
12. Prisma: an `undefined` value in a `where` filter is DROPPED → `deleteMany({ where: { customerId: undefined } })`
   wipes every tenant. Validate every id before any deleteMany/updateMany. No `$transaction` (PgBouncer).
13. Mutating routes that matter to the owner log via `logActivity(..., { businessId, entityType, entityId, entityLabel })`
   (`await` it for sensitive actions). Action names only from `src/lib/activity-actions.ts`.
10. Verification before your final report: `npx tsc --noEmit -p tsconfig.json` (≈1 min, must be
   0 errors in your files — if another agent's in-progress file errors, say so, don't fix it),
   your jest tests pass, `node scripts/audit-route-auth.mjs` passes, `npx next lint --file <your files>`
   has no errors.
11. Final report: files changed/created, API contracts (method, path, query/body, response shape),
   verification output, risks/open items, requests for other files.
