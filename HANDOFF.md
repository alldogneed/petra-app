# Petra App — Session Handoff (2026-06-13, MCP Pre-Prod Audit + Fix Sprint A)

---

## 0. עדכון אחרון — Audit + Fix Sprint A (2026-06-13)

**Pre-production security audit הופק** → `docs/mcp-audit-report.md` (Go-with-conditions לביטא סגור).
ואז **Fix Sprint A** טיפל ב-3 פריטי HIGH + ממצא שהתגלה תוך כדי (F-1). הכול על `feature/mcp-service-layer`, **לא merged ל-main**.

| תיקון | Commit | מצב |
|------|--------|-----|
| F-1 — `/api/mcp` נחסם ע"י edge middleware (הפיצ'ר לא היה נגיש מבחוץ!) | `ae8f530` | ✅ נוסף ל-`PUBLIC_EXACT_PATHS` (exact, לא prefix) |
| #1 — Rate limiting (per-token 100/min + per-IP 10/min fail) | `d2e2e53` | ✅ |
| #2 — Global kill switch `MCP_ENABLED` (fail-open) + `docs/operations.md` runbook | `c758ccb` | 🟡 kill switch ✅; live 503 test דחוי (FS) |
| #3 — תיקון הערת `bcrypt`→SHA-256 ב-schema (×2 קבצים) | `58338f5` | ✅ הערה בלבד |

**נדחה במכוון (החלטת בעלים):** H-2 (`send_reminder` tier/opt-out bypass), H-4 (audit-log PII redaction) — יש defense-in-depth, לא קריטי לביטא של 3-5 לקוחות.
**Follow-ups פתוחים** (`docs/mcp-audit-followup.md`): F-2 (לאמת `MCP_ENABLED=false`→503 חי אחרי reboot — תקלת FS חסמה), F-3 (אין test coverage — לפני post-beta).
**⚠️ ידוע:** במהלך הסשן ה-FS של המכונה נכשל לסירוגין (dev server + git commit נתקעו; התאושש). שווה reboot/בדיקת דיסק.

---

## 1. מצב נוכחי

### Branch: `feature/mcp-service-layer`
- **Latest commit**: `58338f5` (Fix Sprint A #3) — audit fixes complete (3/4 HIGH addressed)
- **TypeScript**: ✅ clean (`tsc --noEmit`)
- **DB schema**: ✅ synced (schema.production.prisma = schema.prisma)
- **Production**: ⛔ NOT pushed — all MCP work stays on feature branch until complete

### Pre-Launch Checklist
| פריט | סטטוס |
|------|-------|
| Email (Resend) — petra-app.com verified | ✅ |
| WhatsApp Meta Cloud API — +972 51-531-1435 | ✅ |
| CRON_SECRET in Vercel | ✅ |
| Google OAuth — approved 2026-04-11 | ✅ |
| Sentry — DSN + auth token, EU ingest | ✅ |
| Vercel Pro (required for cron accuracy) | ⏳ |
| Stripe Checkout | ⏳ |

---

## 2. MCP Project — מה הושלם

### Phase 0 ✅ — Service Layer Foundation
All 11 domains extracted to src/services/:
- clients.ts, appointments.ts, boarding.ts, orders.ts, pets.ts
- training.ts, service-dogs.ts, notifications.ts, business.ts
- ~50 routes thinned, 0 regressions

### Phase 1+2 ✅ — MCP Server + Tools + UI

**MCP Server** (src/app/api/mcp/route.ts)
- Streamable HTTP transport (stateless, Vercel serverless compatible)
- Bearer token auth → McpConnection.tokenHash (SHA-256)
- Per-request audit log to McpAuditLog table
- 6 tools: list_clients, list_upcoming_appointments, get_business_stats, create_appointment, add_client_note, send_reminder

**Token Management**
- POST /api/mcp/connections — create token (shown once)
- GET /api/mcp/connections — list active connections
- DELETE /api/mcp/connections/[id] — revoke

**Settings UI** — הגדרות → עוזרי AI
- McpConnectionsTab: create/revoke with token reveal + Claude Desktop config snippet
- Paywall: basic+ only

**Owner Dashboard** — /owner/mcp
- Metrics: active connections, calls/24h, errors, popular tools
- Audit log tail

**Help Page** — /help/connect-ai
- Step-by-step guide for connecting Claude Desktop (RTL)

**DB Schema** — 2 new models:
- McpConnection (businessId, name, tokenHash, scopes, lastUsedAt, revokedAt)
- McpAuditLog (connectionId, toolName, params, status, resultSummary)

---

## 3. מה נשאר (Phase 3)

### Phase 3.1 — ביטא סגור
- **בידי בעל העסק**: בחר 3-5 לקוחות לביטא
- **בידי בעל העסק**: עשה להם onboarding ידני
- צור docs/mcp-beta-feedback.md לפידבק

### Phase 3.2 — מטריקות ✅
- Owner dashboard נבנה כבר ב-Phase 2 (/owner/mcp)

### Phase 3.3 — תמחור
- **דרוש אישור בעל העסק** אחרי 2-3 שבועות ביטא

---

## 4. כדי להתחיל לעבוד עם Claude Desktop

הוסף ל-claude_desktop_config.json:
```json
"petra": {
  "url": "https://petra-app.com/api/mcp",
  "headers": {
    "Authorization": "Bearer YOUR_TOKEN"
  }
}
```
קבל טוקן מ: הגדרות → עוזרי AI → חבר עוזר חדש

---

## 5. Deploy לפרודקשיין

כשמוכן לעלות (אחרי אישור):
```bash
git checkout main
git merge feature/mcp-service-layer
git push origin main
```
Then in Vercel: redeploy (DB tables already created via prisma db push).

---

## 6. Quick Dev Setup
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npm install
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma generate
# Start dev server (Hebrew path workaround):
(export PATH="/Users/or-rabinovich/local/node/bin:$PATH"; cd HEBREW_PATH/petra-app; node node_modules/.bin/next dev)
```
