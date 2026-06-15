# Petra — Operations Runbook

Operational procedures for running Petra in production. Keep this short and accurate.

---

## Emergency Procedures

### MCP — Global Kill Switch

The MCP server (`/api/mcp`) can be shut off platform-wide with a single environment
variable, without a code change. This is the fastest way to respond to a leaked token,
abuse, or a critical MCP bug.

**Semantics (fail-open):** MCP is disabled **only** when `MCP_ENABLED` is the exact
string `false`. If the variable is unset — or set to any other value (`true`, `1`,
`disabled`, `FALSE`, …) — MCP stays **active**. This keeps MCP working by default in
every environment (prod, staging, local dev) and treats the kill switch as opt-in.

When triggered, every request to `/api/mcp` returns:

```
HTTP 503
{ "error": "mcp_service_unavailable", "message": "MCP service is temporarily unavailable" }
```

The check runs **before** authentication and rate limiting, so no token is validated and
no audit row is written while MCP is off.

#### To disable MCP in an emergency

1. Vercel → Project → Settings → Environment Variables
2. Edit `MCP_ENABLED` → set value to: `false` (lowercase, no quotes)
3. Redeploy (or wait ~30s if using runtime env)

#### To re-enable

- Set `MCP_ENABLED` back to: `true` (or simply remove the variable — unset = active)

> **Note:** Only the exact string `false` triggers the kill switch. Any other value
> (`true`, `1`, `disabled`, `FALSE`) leaves MCP active.

#### Revoking individual tokens (narrower than the kill switch)

To cut off a single business/connection rather than all of MCP, revoke its token(s)
in the app: **Settings → עוזרי AI** → revoke the connection. (Bulk "revoke all tokens
for a business" in one action is not yet built — tracked in `docs/mcp-audit-report.md`.)

#### Who is authorized

- Or Rabinovich
- Ariel

#### When to use it (example scenarios)

- A token is suspected leaked and you can't immediately identify which connection.
- An MCP client is hammering the API beyond what rate limiting absorbs.
- A critical bug is discovered in an MCP tool that could return or mutate wrong data.
- Any incident where "turn MCP off now, investigate after" is the right call.

---

## Related docs

- `docs/mcp-audit-report.md` — MCP pre-production security audit + findings
- `docs/mcp-audit-followup.md` — out-of-scope follow-up findings
- `docs/deployment.md` — branches, Vercel, Supabase
