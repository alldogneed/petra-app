# Security-review subagent prompt (READ-ONLY; spawn with subagent_type general-purpose)

READ-ONLY pre-production security + correctness review. Do not edit files.
Worktree: <path> (branch <branch>, base origin/main = <sha>). Ignore git warnings about /private/tmp/petra-objdir.
Review `git diff origin/main...HEAD`: <list files>. Spec the implementers followed: <spec path>. Reference modules already reviewed: src/lib/mcp/tools-boarding.ts, tools-training.ts, tools-calendar.ts.

Check with file:line evidence:
1. Tenant isolation in EVERY new tool: every prisma query / service call scoped by ctx.businessId; client-supplied ids verified to belong to the business BEFORE use (by the service or the tool).
2. Scope enforcement first in each handler; scope names exist in DEFAULT_MCP_SCOPES; READ_ONLY_MCP_SCOPES has no write:*; effectiveScopes only matches the exact historical sets.
3. Idempotency: findIdempotentReplay before any write; params passed to auditLog include idempotency_key; resultSummary id-only (no names/phones/notes); new PII-ish param names not in PII_PARAM_KEYS — list them.
4. dry_run: zero DB writes; side effects (reminders/GCal/invoicing/WhatsApp) only on real writes, mirrored from the UI routes (<routes>) and awaited + caught. Any path that sends a customer WhatsApp/email unexpectedly?
5. Input validation bounds; enums match Prisma/service constants; dates via parseYmd; HH:MM regex; no unbounded queries.
6. Type/compile risks (scoped tsc already passed — still flag suspicious spots).
7. Anything severe (secrets, token logging, DoS vectors).

Return: verdict SAFE-TO-SHIP / SHIP-WITH-FIXES / DO-NOT-SHIP; severity-tagged findings (file:line — issue — concrete fix); then what you verified clean. Concrete, no speculation.
