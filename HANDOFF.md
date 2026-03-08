# Petra App — Session Handoff (2026-03-07, Session 8)

---

## 1. What We Did Today

### Pets Module — Full Build (`787d0d8`)

Complete overhaul of the pet management experience:

| Feature | Details |
|---------|---------|
| **Weight tracking** | `PetWeightEntry` model — add/delete entries, inline SVG line chart, table view. API: `GET/POST/DELETE /api/pets/[petId]/weight` |
| **Photo gallery** | Upload `image/*` via `/api/pets/[petId]/attachments`, grid view, lightbox on click, delete |
| **Boarding care log** | "יומן טיפול" link per active/reserved stay in boarding page. `BoardingCareLog` model. API: `GET/POST/DELETE /api/boarding/[id]/care-logs`. Types: FEEDING / MEDICATION / WALK / NOTE |
| **Breed combobox** | 60+ dog breeds + 14 cat breeds, free-type, shown only for dog/cat species. Component: `BreedCombobox` in customer profile |
| **Pets list filters** | Gender filter + vaccine status filter on `/pets` page |
| **XLSX export** | "ייצוא XLSX" button on `/pets` page — all pets with full info. API: `GET /api/pets/export` |

Schema changes pushed to production:
- `PetWeightEntry` model: `petId`, `businessId`, `weight`, `recordedAt`, `notes`
- `Pet.weightHistory` relation
- `Business.petWeightEntries` relation

### Orders + Payments Improvements (`00240a6`, `ce4a64f`, `cf74ca7`, `3356c5c`)

| Commit | Feature |
|--------|---------|
| `00240a6` | Payment status badge on orders list + "תשלום" section in order detail. "הוסף תשלום" modal inside order detail page |
| `ce4a64f` | Payment status filter on orders list: All / שולם / טרם שולם |
| `cf74ca7` | Pay-at-checkout in order creation modal — optional immediate payment entry when creating an order |
| `3356c5c` | Export orders to Excel (XLSX) and PDF. API: `GET /api/orders/export?format=xlsx|pdf` |

### Help Center — 3-Tab Layout + Floating FAB (this session, uncommitted)

Rewrote `HelpCenter.tsx` from a single FAQ tab into a 3-tab modal, lifted state to `app-shell.tsx`, and added a floating "?" button accessible from every page.

**Tab 1 — שאלות נפוצות:**
- Kept existing search + category filter pills
- Added 3 new FAQ items in "חיות מחמד" category:
  - "איך עובד מעקב המשקל?" — explains weight chart
  - "איך מעלים תמונות לחיה?" — explains photo gallery + lightbox
  - "מה זה יומן הטיפול בפנסיון?" — explains boarding care log

**Tab 2 — מה חדש (Changelog):**
- Static array, newest-first, 4 entries: v8.0, v7.0, v6.0, v5.0

**Tab 3 — צרו קשר:**
- Placeholder WhatsApp + email — **needs real contact details** (see Section 3)

**Floating FAB:**
- `app-shell.tsx` now owns `helpOpen` state and renders `<HelpCenter>`
- Fixed-position `?` button: `bottom-20 left-4 md:bottom-6 md:left-6 z-40`
- Sidebar "עזרה" button calls `props.onHelpOpen()` instead of managing its own state
- `sidebar.tsx` no longer imports or renders `HelpCenter`

### Dashboard & Customers — RTL Alignment Fix (this session, uncommitted)

**Problem:** Page headers had `flex justify-between` — title FIRST (→ visual RIGHT in RTL), buttons SECOND (→ visual LEFT in RTL).

**Dashboard fix:** Removed `justify-between`, changed to a vertical stack:
```
[שלום, אור רבינוביץ׳ 👋]   ← top, right-aligned naturally in RTL
[יום שבת, 7 במרץ 2026]
[לקוח חדש] [קביעת תור ידני] [הזמנה חדשה] [טופס קליטה] [תורים אונליין]
```
Both greeting and buttons are in a single `space-y-3` column, naturally right-aligned in RTL.

**Customers fix:** Swapped DOM order — buttons div FIRST (→ RIGHT in RTL), title div SECOND (→ LEFT in RTL).

---

## 2. What's Working

- ✅ Production at `petra-app.com` — latest deployed commit `3356c5c`
- ✅ Pets module: weight tracking, photo gallery, boarding care logs, breed combobox, XLSX export, filters
- ✅ Orders: payment status badge, payment filter, pay-at-checkout, XLSX+PDF export
- ✅ Help Center: 3 tabs (FAQ / מה חדש / צרו קשר), floating FAB on all pages — **not yet deployed**
- ✅ Dashboard header: greeting above buttons, both right-aligned — **not yet deployed**
- ✅ Customers header: buttons right-aligned — **not yet deployed**
- ✅ WhatsApp: Meta Cloud API live (temp token — see Section 3)
- ✅ GCal sync for Appointments
- ✅ TypeScript: clean

---

## 3. What's Broken or Incomplete

### ⚠️ META_WHATSAPP_TOKEN expires ~2026-03-08 20:16 (URGENT)
Temporary 24-hour token. After expiry, WhatsApp falls back to stub mode (logs only).
**Fix:** Go to Meta Developer Console → add real Israeli phone number → generate permanent token → update `META_WHATSAPP_TOKEN` in Vercel.

### ⚠️ This session's changes not yet committed or deployed
5 files changed locally, not pushed:
- `src/components/help/HelpCenter.tsx`
- `src/components/layout/app-shell.tsx`
- `src/components/layout/sidebar.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/customers/page.tsx`

### Help Center — contact details are placeholders
- WhatsApp number: `050-000-0000` (fake)
- Email: `support@petra-app.com` (fake)
- File: `src/components/help/HelpCenter.tsx` — search for `050-000-0000`

### GitHub Actions cron not active
`CRON_SECRET` not added to GitHub repo secrets yet.
- GitHub → `alldogneed/petra-app` → Settings → Secrets → Actions → New secret
- Name: `CRON_SECRET`, Value: from `.env` file

### RESEND_API_KEY not set
Email delivery (password reset, reminders) silently fails.

### Google Calendar not connected
User must go to Petra → Integrations page → Connect Google Calendar.

### `/intake` middleware bug
`/intake` dashboard page accessible without auth (prefix match issue in middleware). Low priority.

### Group training validation (session 4, unresolved)
`!groupsLoading` guard needed in `CreateOrderModal.tsx` for the "no groups exist" condition.

---

## 4. Exact Stopping Point

- Last action: customers page RTL alignment fix
- TypeScript: clean (`tsc --noEmit` passes)
- **5 files uncommitted** — help center + RTL fixes sitting in working tree
- Previously deployed: `3356c5c` (orders export)
- No schema changes this session

---

## 5. Next Step — First Thing to Do Next Session

**Step 1 — Commit and deploy this session's changes (3 min):**
```bash
cd '/Users/or-rabinovich/Desktop/פיתוח/petra-app'
git add src/components/help/HelpCenter.tsx \
        src/components/layout/app-shell.tsx \
        src/components/layout/sidebar.tsx \
        src/app/(dashboard)/dashboard/page.tsx \
        src/app/(dashboard)/customers/page.tsx
git commit -m "feat: help center 3-tab + FAB, dashboard/customers RTL alignment"
git push origin main
vercel --prod
```

**Step 2 — Fill in real contact details in Help Center (2 min):**
Open `src/components/help/HelpCenter.tsx`, find these two placeholders and replace:
- `href="https://wa.me/972500000000"` → real WhatsApp support number
- `050-000-0000` → real phone display text
- `support@petra-app.com` → real support email

**Step 3 — Fix Meta WhatsApp token before it expires (15 min, URGENT):**
1. `https://developers.facebook.com/apps/940078891940194/whatsapp-business/wa-dev-console/`
2. "From" dropdown → "Add phone number" → Israeli number → SMS verify
3. Generate permanent token → update `META_WHATSAPP_TOKEN` in Vercel → `vercel --prod`

---

## 6. Open Questions

1. **Help Center contact details** — What real WhatsApp number and email should appear on the "צרו קשר" tab?

2. **Meta WhatsApp permanent token** — Need to add a real Israeli phone number to Meta Dev Console before the temp token expires (~2026-03-08 20:16).

3. **Changelog ownership** — The `v8.0`/`v7.0` entries in the Help Center "מה חדש" tab are hardcoded in `HelpCenter.tsx`. After each session, a new entry should be added. Should this stay manual or be data-driven?

4. **GitHub Actions cron** — Still needs `CRON_SECRET` added to GitHub repo secrets (`alldogneed/petra-app` → Settings → Secrets → Actions).

5. **RESEND_API_KEY** — Email reminders + password reset not working. Open [resend.com](https://resend.com), create free key, add to Vercel.

6. **Document storage at scale** — Insurance PDFs + dog photos stored as base64 in DB. Fine for now; consider migrating to Vercel Blob if DB size becomes an issue.

7. **Group training validation** — `!groupsLoading` guard in `CreateOrderModal.tsx` unconfirmed in production.

8. **Orders PDF export** — PDF is generated server-side. Verify it renders correctly with Hebrew RTL text in production (Hebrew fonts in Node.js PDF libs can be tricky).

---

## 7. Files Changed This Session

### Commits Since Last Handoff

| Commit | What |
|--------|------|
| `787d0d8` | Pets module: weight tracking, photo gallery, boarding care logs, breed combobox, export, filters |
| `2eedc1d` | Meta WhatsApp Cloud API (priority over Twilio) |
| `00240a6` | Payment status on orders — list badge + detail section + add payment modal |
| `ce4a64f` | Payment status filter on orders list |
| `cf74ca7` | Pay-at-checkout in order creation modal |
| `3356c5c` | Export orders to Excel and PDF |

### Uncommitted Changes (this session — need to be committed)

| File | Change |
|------|--------|
| `src/components/help/HelpCenter.tsx` | Complete rewrite: 3-tab layout, changelog data, contact section, 3 new pet FAQ items |
| `src/components/layout/app-shell.tsx` | Lifted `helpOpen` state; added floating FAB; renders `<HelpCenter>`; passes `onHelpOpen` to Sidebar |
| `src/components/layout/sidebar.tsx` | Removed local HelpCenter state + render; accepts `onHelpOpen` prop |
| `src/app/(dashboard)/dashboard/page.tsx` | Header: vertical stack — greeting above buttons, both right-aligned in RTL |
| `src/app/(dashboard)/customers/page.tsx` | Header: buttons div first (→ RIGHT in RTL), title div second |

### Schema Changes (this session — already pushed)
None this session. Schema was last updated in the pets module commit (`787d0d8`):
- `PetWeightEntry` model added
- `Pet.weightHistory` relation
- `Business.petWeightEntries` relation

---

## Production Status

| Item | Status |
|------|--------|
| Latest deployed commit | `3356c5c` |
| Uncommitted local changes | ⚠️ 5 files (help center + RTL fixes) |
| Production (petra-app.com) | ✅ Running `3356c5c` |
| TypeScript | ✅ Clean |
| DB schema | ✅ Synced |
| Pets module | ✅ Weight + gallery + care logs + export |
| Orders export | ✅ XLSX + PDF |
| Help Center 3-tab + FAB | ⚠️ Built, not yet deployed |
| WhatsApp (Meta) | ⚠️ Live — temp token expires ~2026-03-08 20:16 |
| WhatsApp (real customers) | ⏳ Pending real phone number in Meta |
| Google Calendar | ⏳ Pending OAuth connection by user |
| GitHub Actions cron | ⏳ Pending `CRON_SECRET` secret in GitHub |
| RESEND_API_KEY | ⏳ Pending setup |
