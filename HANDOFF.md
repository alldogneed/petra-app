# Petra App — Session Handoff (2026-03-07, Session 6)

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

### Service Dog Module Expansion (background, previous sessions)

| Commit | What changed |
|--------|-------------|
| `392be6d` | Service dogs tab — detailed session log + rename button to "אימון חדש" |
| `1512793` | **Alerts system** — sidebar badge, overview widget, daily cron |
| `a06d3d0` | Rename "כרטיסי זיהוי" → "הסמכה", add PDF download, add reports tab |
| `2f7f262` | Smart protocol auto-generation from health data |
| `af4e170` | Full module expansion: milestones, insurance, vests, recipients Kanban |
| `5a4e645` | Reports page — upcoming renewals + recipients by funding source |
| `6c521f7` | Recipient profile — link to customer, government report, overview pipeline widget |
| `3f7eec1` | Israeli-specific medical protocols |

### Excel Export for Service Dogs & Recipients (`37e00a2`)

Two new XLSX export endpoints + download buttons in the reports page header:

- **`GET /api/service-dogs/export`** — 29 columns: pet details, phase, training hours/status, registration, certifying body, certification dates, license, pedigree, purchase info, medical compliance %, last milestone, active placement recipient, insurance info, notes
- **`GET /api/service-recipients/export`** — 19 columns: name, phone, email, ID number, address, pipeline stage, disability type/notes, funding source, dates (waitlist/intake/approved), matched dog, placement status, linked customer, notes

### Five Service Dogs Improvements (`c1cf106`)

| Feature | What changed |
|---------|-------------|
| Training tests — dog selector | Test form now has a dog dropdown; tests can link to any dog in the business |
| Insurance — file upload | Policy documents (PDF/image ≤5MB) stored as base64 in `policyDocument` field |
| Recipients Kanban — editable columns | Rename, delete, add columns with color picker; backed by `ServiceRecipientStage` model |
| Recipients Kanban — drag & drop | Cards between columns (PATCH status) + column reorder (PATCH sortOrder) using @dnd-kit |
| ID card — dog photo | Upload from "תעודת הסמכה" tab, stored as base64 in `dogPhoto`; only manual card generation |

**Schema changes pushed to production DB:**
- `ServiceDogInsurance.policyDocument String?`
- `ServiceDogProfile.dogPhoto String?`
- New `ServiceRecipientStage` model (auto-seeds 8 built-in stages per business)

### Security Audit + IDOR Fixes (`7b9971d`)

QA pass on the full service dogs module. Found and fixed 5 IDOR vulnerabilities where dog ownership was verified via an earlier `findFirst` but subsequent data queries didn't scope to `businessId`:

| Route | Issue Fixed |
|-------|-------------|
| `service-dogs/[id]/medical` GET | protocols `findMany` missing `businessId` filter |
| `service-dogs/[id]/medical` PATCH | `update` where clause missing `businessId` |
| `service-dogs/[id]/training` GET | training logs `findMany` missing `businessId` filter |
| `service-dogs/[id]/training` POST | `ServiceDogProfile.update` where clause missing `businessId` |
| `service-dogs/[id]/compliance` GET | compliance events `findMany` missing `businessId` filter |

---

## 2. What's Working

- ✅ Production at `petra-app.com` — latest commit `7b9971d`
- ✅ Cron auth: all routes accept `Authorization: Bearer` (Vercel Cron format)
- ✅ GCal sync for Appointments: create/update/cancel/delete fires automatically
- ✅ GitHub Actions workflow: `send-reminders` every 15min, `process-jobs` every 5min (pending: add `CRON_SECRET` secret to GitHub)
- ✅ Service dog file upload to Vercel Blob
- ✅ Service dog module: alerts system, reports, milestones, insurance, PDFs, DnD Kanban, editable columns, exports
- ✅ Service dog IDOR: 5 businessId filter bugs fixed
- ✅ TypeScript: clean
- ✅ DB schema: `Appointment.gcalEventId`, `ServiceDogInsurance.policyDocument`, `ServiceDogProfile.dogPhoto`, `ServiceRecipientStage` pushed to production

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

- Session ended with: security audit + IDOR fixes + HANDOFF.md update
- Latest deployed commit: `7b9971d` (via `vercel --prod`)
- TypeScript: clean
- Git: local `main` is ahead of `origin/main` (workflow scope issue — see below)

---

## 5. Next Step — First Thing to Do Next Session

**Fix remaining service dogs QA issues (30 min):**

1. **MIME validation on document upload** (`src/app/api/service-dogs/[id]/documents/route.ts`):
   ```typescript
   const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
   const ext = file.name.split(".").pop()?.toLowerCase() || "";
   if (!ALLOWED_TYPES.includes(file.type) || !["pdf","jpg","jpeg","png","webp"].includes(ext)) {
     return NextResponse.json({ error: "סוג קובץ לא נתמך" }, { status: 400 });
   }
   ```

2. **Milestone key validation** (`src/app/api/service-dogs/[id]/milestones/route.ts`, PATCH):
   - Get the `MILESTONE_KEYS` array from the GET handler in the same file
   - Validate that `milestoneKey` is in the list before upsert

3. **Verify QR token public endpoint** (`src/app/api/service-dogs/id-card/[token]/route.ts`):
   - Confirm it shows only minimal public info (dog name, registration number)
   - Should NOT expose recipient medical/disability data

**Connect WhatsApp (5 min):**
1. Open [console.twilio.com](https://console.twilio.com) → Account Info
2. Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` to Vercel env
3. Redeploy: `vercel --prod`

**Activate GitHub Actions cron (2 min):**
1. GitHub → `alldogneed/petra-app` → Settings → Secrets → Actions
2. Add `CRON_SECRET` = value from `.env`

---

## 6. Open Questions

1. **GitHub push blocked** — Local `main` is many commits ahead of `origin/main`. Need to run `gh auth refresh -h github.com -s workflow` interactively to grant workflow scope, then `git push origin main`.
2. **WhatsApp phone number** — Is the Twilio number already a WhatsApp Business number? Registration takes 2–7 days with Meta.
3. **QR ID card public data** — What info should the public QR card show? Currently exposes dog registration + name. Should NOT show recipient disability/medical info.
4. **Document storage at scale** — Insurance PDFs + dog photos stored as base64 in DB. Fine for now but will bloat at scale. Consider migrating to Vercel Blob.
5. **RESEND_API_KEY** — Email reminders need this. Open resend.com, create key, set in Vercel.
6. **Group training validation** — Still unconfirmed in production. `!groupsLoading` guard needed in `CreateOrderModal.tsx`.
7. **Service dog reports PDF** — Is the government report format correct? Needs user verification.

---

## 7. Files Changed This Session

### New Files (this session)
| File | Purpose |
|------|---------|
| `src/app/api/service-dogs/[id]/documents/route.ts` | File upload to Vercel Blob for service dog documents |
| `src/lib/cron-auth.ts` | Shared cron auth helper (Authorization: Bearer + x-cron-secret) |
| `.github/workflows/cron.yml` | GitHub Actions: 15-min reminders + 5-min GCal sync |
| `src/app/api/service-dogs/export/route.ts` | XLSX export for all service dogs (29 cols) |
| `src/app/api/service-recipients/export/route.ts` | XLSX export for all recipients (19 cols) |
| `src/app/api/service-recipient-stages/route.ts` | GET (auto-seed 8 stages) + POST custom stage |
| `src/app/api/service-recipient-stages/[id]/route.ts` | PATCH rename/reorder + DELETE stage |

### Modified Files (this session)
| File | Change |
|------|--------|
| `src/app/(dashboard)/service-dogs/[id]/page.tsx` | File upload UI in DocumentsTab; dog photo on ID card; insurance file upload; training test dog selector |
| `src/app/(dashboard)/service-dogs/reports/page.tsx` | XLSX download buttons |
| `src/app/(dashboard)/service-dogs/recipients/page.tsx` | Complete rewrite: DnD + dynamic stages + editable columns |
| `src/app/api/service-dogs/[id]/route.ts` | Added `dogPhoto` to PATCH handler |
| `src/app/api/service-dogs/[id]/insurance/route.ts` | Added `policyDocument` to POST |
| `src/app/api/service-dogs/[id]/medical/route.ts` | **Security**: businessId added to protocols GET + PATCH |
| `src/app/api/service-dogs/[id]/training/route.ts` | **Security**: businessId added to logs GET + profile PATCH |
| `src/app/api/service-dogs/[id]/compliance/route.ts` | **Security**: businessId added to compliance events GET |
| `src/lib/google-calendar.ts` | `syncAppointmentToGcal`, `deleteAppointmentFromGcal` |
| `src/app/api/appointments/route.ts` | GCal sync on create |
| `src/app/api/appointments/[id]/route.ts` | GCal sync on update/cancel/delete |
| `src/app/api/cron/send-reminders/route.ts` | Use `verifyCronAuth` helper |
| `src/app/api/cron/generate-tasks/route.ts` | Use `verifyCronAuth` helper |
| `src/app/api/cron/birthday-reminders/route.ts` | Use `verifyCronAuth` helper |
| `src/app/api/cron/vaccination-reminders/route.ts` | Use `verifyCronAuth` helper |
| `src/app/api/integrations/google/process-jobs/route.ts` | Use `verifyCronAuth` helper |
| `prisma/schema.prisma` | `Appointment.gcalEventId`, `ServiceDogInsurance.policyDocument`, `ServiceDogProfile.dogPhoto`, `ServiceRecipientStage` model |
| `prisma/schema.production.prisma` | Synced |
| `vercel.json` | Added `process-jobs` + `service-dog-alerts` daily crons |

---

## Production Status

| Item | Status |
|------|--------|
| Latest commit | `7b9971d` |
| Production (petra-app.com) | ✅ Deployed via Vercel CLI |
| TypeScript | ✅ Clean |
| Git (local vs origin) | ⚠️ Local ahead (workflow scope issue) |
| DB schema | ✅ Synced (all new fields pushed) |
| Service Dogs IDOR | ✅ 5 bugs fixed |
| Excel Export | ✅ Dogs + Recipients |
| Recipients DnD Kanban | ✅ Cards + Columns |
| WhatsApp | ⏳ Pending Twilio env vars |
| Google Calendar | ⏳ Pending OAuth connection |
| GitHub Actions cron | ⏳ Pending `CRON_SECRET` secret in GitHub |
