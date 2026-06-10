# Petra App — Session Handoff (2026-06-10, Session 30)

---

## 1. מצב נוכחי

### Production
- **Latest commit**: `9aa2704` — `fix(calendar): deduplicate training sessions + fix 3am timezone bug`
- **Deployed**: ✅ Vercel production
- **TypeScript**: ✅ clean
- **DB schema**: ✅ synced (schema.production.prisma = schema.prisma)

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

## 2. Uncommitted Changes (16 files)

שינויי אבטחה מהביקורת שלא נכנסו לcommit הרשמי. צריך review ו-commit:

| קובץ | שינוי |
|------|-------|
| `next.config.mjs` | Image proxy מוגבל ל-hosts מוכרים (SSRF guard) |
| `prisma/schema.prisma` | `ServiceDogPlacement.status` default: PENDING→ACTIVE |
| `prisma/schema.production.prisma` | אותו שינוי |
| `src/app/api/account/change-password/route.ts` | שיפורי אבטחה |
| `src/app/api/account/set-password/route.ts` | שיפורי אבטחה |
| `src/app/api/admin/broadcast-messages/route.ts` | פישוט + hardening |
| `src/app/api/admin/migration/businesses/route.ts` | פישוט |
| `src/app/api/admin/migration/template/route.ts` | פישוט |
| `src/app/api/boarding/route.ts` | הגנות נוספות |
| `src/app/api/booking/book/route.ts` | הגנות נוספות |
| `src/app/api/cron/vaccination-reminders/route.ts` | שיפורים |
| `src/app/api/customers/route.ts` | תיקון קטן |
| `src/app/api/pets/[petId]/documents/route.ts` | שיפורי אבטחה |
| `src/app/api/service-dogs/[id]/documents/route.ts` | שיפורי אבטחה |
| `src/app/api/service-dogs/[id]/upload/route.ts` | תיקון |
| `src/components/layout/topbar.tsx` | תיקון קטן |

**פקודת commit:**
```bash
git add next.config.mjs prisma/schema.prisma prisma/schema.production.prisma \
  src/app/api/account/change-password/route.ts \
  src/app/api/account/set-password/route.ts \
  src/app/api/admin/broadcast-messages/route.ts \
  src/app/api/admin/migration/businesses/route.ts \
  src/app/api/admin/migration/template/route.ts \
  src/app/api/boarding/route.ts \
  src/app/api/booking/book/route.ts \
  src/app/api/cron/vaccination-reminders/route.ts \
  src/app/api/customers/route.ts \
  "src/app/api/pets/[petId]/documents/route.ts" \
  "src/app/api/service-dogs/[id]/documents/route.ts" \
  "src/app/api/service-dogs/[id]/upload/route.ts" \
  src/components/layout/topbar.tsx
git commit -m "security: image proxy SSRF guard + placement status default + API hardening"
git push origin main
```

---

## 3. MCP Integration — הפרויקט הבא

**GOAL**: `~/Desktop/PETRA-MCP-GOAL.md` — MCP integration עם Service Layer.
ה-GOAL file מכיל גם את התוכנית המלאה (אין קובץ Petra-MCP-Plan.md נפרד).

### שלבים לפי GOAL
| שלב | תיאור | סטטוס |
|-----|-------|-------|
| משימה מקדימה | סנכרון HANDOFF.md | ✅ הושלם |
| שלב 0 | Service Layer Foundation | ⏳ הבא |
| שלב 1 | MCP Server Read-Only | ⏳ |
| שלב 2 | כתיבה + UI Onboarding | ⏳ |
| שלב 3 | ביטא + השקה | ⏳ |

**עקרון יסוד**: שכבת שירותים משותפת — גם UI וגם MCP קוראים לאותן פונקציות.
זרימה: `Supabase ← Service Layer ← (UI Routes | MCP Tools)`

---

## 4. סיכום Sessions אחרונים

| Session | תאריך | עבודה עיקרית |
|---------|-------|--------------|
| 28 | יוני 2026 | Training audit: group reminders, FK fixes, recurring sessions |
| 29 | יוני 2026 | Analytics sync, Sentry fixes, mobile QA, Shachar UX |
| 30 | יוני 2026 | Security audit (17 files committed), booking E2E QA, calendar tz fix |

היסטוריה מלאה: `memory/MEMORY.md`

---

## 5. ארכיטקטורה — נקודות חשובות

- **Stack**: Next.js 14, TypeScript, Prisma/PostgreSQL (Supabase), React Query, Tailwind
- **Auth**: `requireBusinessAuth()` + `isGuardError()` בכל route מוגן
- **Rate limiting**: `rateLimitAsync()` (Upstash Redis) לroutes קריטיים, fallback זיכרון
- **Service layer**: **לא קיים עדיין** — כל הלוגיקה העסקית ב-API routes (שלב 0 של MCP יחלץ אותה)
- **Node PATH**: `/Users/or-rabinovich/local/node/bin/` — חובה prefix לכל פקודה
- **Dev server**: `node node_modules/.bin/next dev` (Hebrew path — npm run dev לא עובד)
- **PostCSS**: `8.4.47` — לא לשדרג (8.5.x שובר Next.js 14.2.x)

---

## 6. Branches

| Branch | מטרה |
|--------|------|
| `main` | Production (Vercel auto-deploy) |
| `staging` | Staging (Neon DB) |
| `dev` | לא בשימוש |

---

## 7. Production Accounts

| חשבון | businessId | שם |
|-------|-----------|-----|
| `alldogneed@gmail.com` | `6c51668f-00e9-46b1-9ba2-ff113831a172` | all-dog (ראשי) |
| `or.rabinovich@gmail.com` | `4c0cd6b3-c7a5-4c29-b8f4-1213ede4b893` | אור רבינוביץ׳ |
