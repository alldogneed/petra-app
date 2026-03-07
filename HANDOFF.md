# Petra App — Session Handoff (2026-03-07, Session 5)

---

## 1. What We Did Today

### Service Dog Documents — File Upload (`884e6dd`)
Added file upload to the "מסמכים" tab on the service dog profile page, alongside the existing URL mode:

- **New API route**: `POST /api/service-dogs/[id]/documents` — receives `multipart/form-data`, uploads to Vercel Blob under `service-dogs/[id]/[fileId].[ext]`, saves URL to `ServiceDogProfile.documents` JSON
- **UI toggle**: "קישור URL" / "העלאת קובץ" tab buttons inside the add-document form
- File input accepts `.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp`, max 10MB
- `isUploading` state, `isBusy` disables submit button during upload

### Infrastructure: WhatsApp + GCal Readiness (`8c932c9`, `0c7719f`)

**Fix: Cron auth header mismatch (critical bug)**
All 5 cron routes were checking `x-cron-secret` header, but Vercel Crons send `Authorization: Bearer <CRON_SECRET>`. Every cron job was returning 401 — nothing was running.
- Created `src/lib/cron-auth.ts` — `verifyCronAuth()` accepts **both** `Authorization: Bearer` (Vercel) and `x-cron-secret` (external/manual)
- Updated all routes: `send-reminders`, `generate-tasks`, `birthday-reminders`, `vaccination-reminders`, `process-jobs`

**Fix: GCal sync for staff-created Appointments (was completely missing)**
The GCal sync infrastructure (`SyncJob`, `enqueueSyncJob`) only worked for the `Booking` model (public widget). Staff-created `Appointment` records (via dashboard calendar) had zero GCal sync.
- Added `gcalEventId String?` to `Appointment` model in schema; pushed to production DB
- Added `syncAppointmentToGcal(appointmentId, businessId)` + `deleteAppointmentFromGcal(appointmentId, businessId)` to `google-calendar.ts` — fire-and-forget, per-connected-user, with update-or-recreate logic
- Wired fire-and-forget calls in:
  - `POST /api/appointments` → `syncAppointmentToGcal` on create
  - `PATCH /api/appointments/[id]` → `syncAppointmentToGcal` on update, `deleteAppointmentFromGcal` on cancel
  - `DELETE /api/appointments/[id]` → `deleteAppointmentFromGcal` before DB delete

**Fix: Vercel Cron frequency (Hobby plan limitation)**
Vercel Hobby only allows daily crons. `send-reminders` was running once/day at 6am — reminders could be up to 24h late.
- Added `.github/workflows/cron.yml` — GitHub Actions calls:
  - `send-reminders` every 15 minutes
  - `process-jobs` every 5 minutes
- Vercel daily crons serve as fallback
- **Requires:** `CRON_SECRET` added to GitHub repo secrets (Settings → Secrets → Actions)

**Fix: Added GCal process-jobs to vercel.json**
The `/api/integrations/google/process-jobs` route existed but was never on a schedule.
- Added to `vercel.json` crons (daily at 07:00 UTC as fallback)

### Service Dog Module Expansion (parallel work, same session)

Multiple sessions added significant service dog improvements:

| Commit | What changed |
|--------|-------------|
| `392be6d` | Service dogs tab — detailed session log + rename button to "אימון חדש" |
| `ed739ad` | Full sync between training tab and overview |
| `7d63fd0` | Session modal — רישום אימון + הערות לצוות |
| `1512793` | **Alerts system** — sidebar badge, overview widget, daily cron `/api/cron/service-dog-alerts` (added to vercel.json) |
| `0e049af` | Rename sidebar items — "ניהול כלבי שירות" + "ניהול תהליכי אילוף" |
| `a06d3d0` | Rename "כרטיסי זיהוי" → "הסמכה", add PDF download, add reports tab |
| `2f7f262` | Smart protocol auto-generation from health data + persistent alert dismissals |
| `af4e170` | Full module expansion: milestones, insurance, vests, recipients Kanban |
| `5a4e645` | Reports page — upcoming renewals + recipients by funding source |
| `6c521f7` | Recipient profile — link to customer, government report, overview pipeline widget |
| `4d1905f` | Fix reports page — use session count instead of missing totalHours |
| `a9864aa` | fundingSource in placements page |
| `3f7eec1` | Israeli-specific medical protocols added to PHASE_MEDICAL_PROTOCOLS |
| `37e00a2` | Excel export for service dogs and recipients from reports page |
| `c1cf106` | 5 service dogs improvements (latest) |

---

## 2. What's Working

- ✅ Production at `petra-app.com` — latest commit `c1cf106`
- ✅ Cron auth: all routes accept `Authorization: Bearer` (Vercel Cron format)
- ✅ GCal sync for Appointments: create/update/cancel/delete fires automatically
- ✅ GitHub Actions workflow: `send-reminders` every 15min, `process-jobs` every 5min (pending: add `CRON_SECRET` secret to GitHub)
- ✅ Service dog file upload to Vercel Blob
- ✅ Service dog module: alerts system, reports, milestones, insurance, PDFs, Kanban
- ✅ TypeScript: clean
- ✅ DB schema: `Appointment.gcalEventId` pushed to production

---

## 3. What's Broken or Incomplete

**GitHub Actions cron not active yet**
Requires `CRON_SECRET` to be added to GitHub repo secrets:
- GitHub → `alldogneed/petra-app` → Settings → Secrets and variables → Actions → New secret
- Name: `CRON_SECRET`, Value: `ab3ed3618182e0327460dee9e2b77b085f24e600ca27532e`

**WhatsApp still in stub mode (messages logged, not sent)**
`TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are not set in Vercel:
- Get from [console.twilio.com](https://console.twilio.com) → Account Info
- Set in Vercel → petra-app → Settings → Environment Variables

**Google Calendar not connected**
OAuth tokens not yet set. To connect:
1. User needs to go to Petra → Integrations page → Connect Google Calendar
2. Complete OAuth flow

**RESEND_API_KEY not set** — email delivery silently fails (WhatsApp works independently)

**Group training validation (from session 4, unresolved)**
User reported the red warning + disabled button for group training without a group wasn't visible in production. Likely `!groupsLoading` guard needed on the "no groups exist" condition. See session 4 HANDOFF for the exact fix.

**`/intake` middleware bug** — `/intake` dashboard page accessible without auth (prefix match issue in middleware)

---

## 4. Exact Stopping Point

- Session ended with: CLAUDE.md + HANDOFF.md update
- Branch: `main` = `origin/main` ✅
- Latest deployed commit: `c1cf106`
- Working tree: clean

---

## 5. Next Step — First Thing to Do Next Session

**Connect WhatsApp (5 min):**
1. Open [console.twilio.com](https://console.twilio.com) → Account Info
2. Copy `Account SID` and `Auth Token`
3. Vercel → petra-app → Settings → Environment Variables → Add:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_FROM` = your WhatsApp Business number (e.g. `+972501234567`)
4. Redeploy: `vercel --prod`

**Activate GitHub Actions cron (2 min):**
1. GitHub → `alldogneed/petra-app` → Settings → Secrets → Actions
2. Add `CRON_SECRET` = `ab3ed3618182e0327460dee9e2b77b085f24e600ca27532e`

**Connect Google Calendar (2 min):**
1. Navigate to Petra → Settings → Integrations
2. Click "חבר Google Calendar"
3. Complete OAuth flow
4. Test: create an appointment → verify it appears in Google Calendar within 5 min

---

## 6. Open Questions

1. **WhatsApp phone number** — Is the Twilio number already a WhatsApp Business number, or do you need to register it? (Business number registration takes 2–7 days with Meta.)
2. **Group training validation** — Still visually missing in production? The fix is a `!groupsLoading` guard in `CreateOrderModal.tsx`.
3. **GitHub Pro plan** — Currently on Hobby (daily cron limit). GitHub Actions handles the frequent timing. Is Vercel Pro worth upgrading for? ($20/month = unlimited cron frequency, eliminates GitHub Actions dependency.)
4. **RESEND_API_KEY** — Email reminders (not WhatsApp) need this. When to set up?
5. **Service dog reports PDF** — Is the government report format from commit `6c521f7` correct? Or does it need adjusting?

---

## 7. Files Changed This Session

### New Files
| File | Purpose |
|------|---------|
| `src/app/api/service-dogs/[id]/documents/route.ts` | File upload to Vercel Blob for service dog documents |
| `src/lib/cron-auth.ts` | Shared cron auth helper (Authorization: Bearer + x-cron-secret) |
| `.github/workflows/cron.yml` | GitHub Actions: 15-min reminders + 5-min GCal sync |

### Modified Files (this session's work)
| File | Change |
|------|--------|
| `src/app/(dashboard)/service-dogs/[id]/page.tsx` | File upload UI in DocumentsTab |
| `src/lib/google-calendar.ts` | `syncAppointmentToGcal`, `deleteAppointmentFromGcal`, `AppointmentForGcal` type |
| `src/app/api/appointments/route.ts` | GCal sync on create |
| `src/app/api/appointments/[id]/route.ts` | GCal sync on update/cancel/delete |
| `src/app/api/cron/send-reminders/route.ts` | Use `verifyCronAuth` helper |
| `src/app/api/cron/generate-tasks/route.ts` | Use `verifyCronAuth` helper |
| `src/app/api/cron/birthday-reminders/route.ts` | Use `verifyCronAuth` helper |
| `src/app/api/cron/vaccination-reminders/route.ts` | Use `verifyCronAuth` helper |
| `src/app/api/integrations/google/process-jobs/route.ts` | Use `verifyCronAuth` helper |
| `prisma/schema.prisma` | `Appointment.gcalEventId String?` |
| `prisma/schema.production.prisma` | Synced |
| `vercel.json` | Added `process-jobs` daily cron + `service-dog-alerts` daily cron |
| `CLAUDE.md` | Updated GCal sync, cron, infrastructure sections |

---

## Production Status

| Item | Status |
|------|--------|
| Latest commit | `c1cf106` |
| Production (petra-app.com) | ✅ Deployed |
| TypeScript | ✅ Clean |
| Git | `main` = `origin/main` ✅ |
| DB schema | ✅ Synced (`Appointment.gcalEventId` pushed) |
| WhatsApp | ⏳ Pending Twilio env vars |
| Google Calendar | ⏳ Pending OAuth connection |
| GitHub Actions cron | ⏳ Pending `CRON_SECRET` secret in GitHub |
