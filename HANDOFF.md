# Petra App — Session Handoff (2026-03-07, Session 7)

---

## 1. What We Did Today

### Meta WhatsApp Cloud API Integration (`2eedc1d`)

Replaced Twilio with Meta's official WhatsApp Cloud API as the primary sending provider.

**`src/lib/whatsapp.ts` — full rewrite:**
- Priority chain: **Meta Cloud API → Twilio (fallback) → Stub mode**
- `sendViaMetaCloudApi()` — calls `graph.facebook.com/v19.0/{phoneNumberId}/messages`
- No breaking change — stub still works if no credentials are set
- Twilio code retained as fallback (not needed if Meta is configured)

**Meta Developer App created:**
- App name: `petra`
- App ID: `940078891940194`
- Business Portfolio ID: `722538504279505`
- Use case: "Connect with customers through WhatsApp"

**Vercel environment variables set (production):**
| Variable | Value |
|----------|-------|
| `META_WHATSAPP_TOKEN` | Temporary token (EAANWZCyx...) — **expires ~2026-03-08 20:16** |
| `META_PHONE_NUMBER_ID` | `1038513796008885` |
| `META_WHATSAPP_BUSINESS_ACCOUNT_ID` | `1598250198052129` |

**Current state:** Using Meta's test number (`+1 555 182 7619`). Can only send to phone numbers manually added to Meta's test recipient list. Not yet sending to real customers.

### Inherited from Session 6 (already in prod)
- Service dog file upload to Vercel Blob
- Cron auth fix (all routes accept `Authorization: Bearer`)
- GCal sync for Appointment model (create/update/cancel/delete)
- GitHub Actions workflow: send-reminders every 15min, process-jobs every 5min
- Service dog IDOR: 5 businessId filter bugs fixed
- Excel export for service dogs + recipients
- Recipients DnD Kanban with editable columns

---

## 2. What's Working

- ✅ WhatsApp via Meta Cloud API — deployed, picking up `META_WHATSAPP_TOKEN` + `META_PHONE_NUMBER_ID`
- ✅ Stub fallback — if token expires, messages log to console (no crash)
- ✅ Cron jobs: all 6 routes use `verifyCronAuth()` (accepts both Bearer + x-cron-secret)
- ✅ GCal sync for Appointments: create/update/cancel/delete fires automatically
- ✅ GitHub Actions workflow committed (pending: `CRON_SECRET` secret in GitHub)
- ✅ Service dog module: alerts, reports, milestones, insurance, PDFs, DnD Kanban, exports
- ✅ TypeScript: clean
- ✅ Production at `petra-app.com` — latest commit `2eedc1d`

---

## 3. What's Broken or Incomplete

### ⚠️ META_WHATSAPP_TOKEN expires ~2026-03-08 20:16 (24-hour temp token)
After expiry, WhatsApp falls back to stub mode (messages logged, not sent).
**Fix:** Add a real phone number to Meta → get permanent token → update Vercel env var.

### WhatsApp not sending to real customers yet
Using Meta test environment — messages only reach manually whitelisted numbers.
**Fix:** Add real phone number (see Next Step below).

### GitHub Actions cron not active
`CRON_SECRET` not yet added to GitHub repo secrets.
- GitHub → `alldogneed/petra-app` → Settings → Secrets and variables → Actions → New secret
- Name: `CRON_SECRET`, Value: `ab3ed3618182e0327460dee9e2b77b085f24e600ca27532e`

### RESEND_API_KEY not set
Email delivery (forgot password, email reminders) silently fails.
- Open resend.com → create free account → API Keys → Create key
- Add to Vercel: `RESEND_API_KEY`

### Google Calendar not connected
OAuth tokens not yet set. User must go to Petra → Integrations page → Connect Google Calendar.

### /intake middleware bug
`/intake` dashboard page accessible without auth (prefix match issue in middleware).

### Group training validation (session 4, unresolved)
`!groupsLoading` guard needed on "no groups exist" condition in `CreateOrderModal.tsx`.

---

## 4. Exact Stopping Point

- Session ended after: setting Meta WhatsApp env vars + deploying
- Latest deployed commit: `2eedc1d`
- TypeScript: clean
- WhatsApp: live with temp token (expires tomorrow ~20:16)
- User needs to buy an Israeli phone number to complete setup

---

## 5. Next Step — First Thing to Do Next Session

### Add real phone number to Meta (15 min) — URGENT (do before token expires)

1. Go to: `https://developers.facebook.com/apps/940078891940194/whatsapp-business/wa-dev-console/`
2. Under "Step 1: Select phone numbers" → click **"From"** dropdown → **"Add phone number"**
3. Fill in:
   - Display name: `Petra` (or business name)
   - Category: `Professional Services`
   - Phone number: Israeli number (any SIM — regular number is fine)
4. Choose **SMS** verification → enter code
5. After verified: click **"Generate access token"** again → copy the **permanent token**
6. Update Vercel:
   ```bash
   echo "NEW_PERMANENT_TOKEN" | vercel env rm META_WHATSAPP_TOKEN production -y
   echo "NEW_PERMANENT_TOKEN" | vercel env add META_WHATSAPP_TOKEN production
   echo "NEW_PHONE_NUMBER_ID" | vercel env rm META_PHONE_NUMBER_ID production -y
   echo "NEW_PHONE_NUMBER_ID" | vercel env add META_PHONE_NUMBER_ID production
   vercel --prod
   ```

### After phone number is live: test end-to-end
Send a test reminder manually via the cron endpoint:
```
GET https://petra-app.com/api/cron/send-reminders
Authorization: Bearer ab3ed3618182e0327460dee9e2b77b085f24e600ca27532e
```
Check Vercel logs to confirm WhatsApp message was sent (not stub).

---

## 6. Open Questions

1. **Permanent WhatsApp token** — After adding real phone number, generate permanent token and update `META_WHATSAPP_TOKEN` in Vercel before the temp token expires (~2026-03-08 20:16).
2. **Which phone number?** — Any Israeli number works (regular SIM). Does not need to be a WhatsApp Business number already — Meta registers it.
3. **GitHub Actions cron** — Still needs `CRON_SECRET` added to GitHub secrets.
4. **RESEND_API_KEY** — Email reminders (forgot password etc.) still not working.
5. **Google Calendar** — Not connected. Go to Petra → Integrations → Connect Google Calendar.
6. **Document storage at scale** — Insurance PDFs + dog photos stored as base64 in DB. Consider migrating to Vercel Blob.
7. **Group training validation** — `!groupsLoading` guard unconfirmed in production.
8. **Service dog reports PDF** — Government report format needs user verification.

---

## 7. Files Changed This Session

### Modified Files
| File | Change |
|------|--------|
| `src/lib/whatsapp.ts` | Full rewrite: Meta Cloud API primary, Twilio fallback, stub last |

### Vercel Environment Variables Added
| Variable | Purpose |
|----------|---------|
| `META_WHATSAPP_TOKEN` | Meta Cloud API auth token (temporary, expires 2026-03-08) |
| `META_PHONE_NUMBER_ID` | Meta test phone number ID (`1038513796008885`) |
| `META_WHATSAPP_BUSINESS_ACCOUNT_ID` | Meta WABA ID (`1598250198052129`) |

---

## Production Status

| Item | Status |
|------|--------|
| Latest commit | `2eedc1d` |
| Production (petra-app.com) | ✅ Deployed |
| TypeScript | ✅ Clean |
| WhatsApp (Meta) | ⚠️ Test mode — temp token expires ~2026-03-08 20:16 |
| WhatsApp (real customers) | ⏳ Pending real phone number |
| Google Calendar | ⏳ Pending OAuth connection |
| GitHub Actions cron | ⏳ Pending `CRON_SECRET` secret in GitHub |
| RESEND_API_KEY | ⏳ Pending setup |
| DB schema | ✅ Synced |
