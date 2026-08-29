# פטרה — מודול שיעורי אונליין (Online Classes)

> מסמך context ראשי למודול. מקור: petra-online-classes-kickoff.md + החלטות סשן 2026-08-29.

## מה בונים — במשפט אחד

מודול multi-tenant שבו כל עסק מציע לבעלי כלבים פורטל ממותג (white-label) עם מנוי, שיעורים חיים בזום עם קיבולת, וקורסים מוקלטים בסגנון Udemy (יוטיוב לא רשום).

## החלטות מוצר — סגורות

1. **חלק מפטרה**, אותו ריפו/סטאק: Next.js 14, TypeScript, Tailwind, Supabase, Prisma, Vercel.
2. **PWA / web רספונסיבי** לצד בעלי הכלבים. לא אפליקציה נטיבית.
3. **תשלום מחוץ למערכת בשלב 1.** העסק מגדיר לינק תשלום חיצוני. בעל כלב מבקש מנוי ← אישור ידני של בעל העסק. Cardcom לא נוגעים.
4. **וידאו ביוטיוב לא רשום** בערוץ של כל עסק. שדה `provider` לשינוי עתידי (Mux/Stream).
5. **PortalUser גלובלי** (טלפון E.164 מזהה ייחודי) + `Membership` פר עסק. בידוד מלא בין עסקים.
6. **`businessId` על כל טבלה** במודול + סינון tenant בכל שאילתה.
7. מיתוג: לוגו, צבעים, שם שולח, טקסט אודות. כתובת: `/c/{slug}` — **משתמשים ב-`Business.slug` הקיים** (כבר unique, משמש `/book/{slug}`). דומיין אישי — שלב מאוחר.
8. "Powered by Petra" בפוטר הפורטל.

## החלטות סשן (2026-08-29)

| נושא | החלטה |
|------|-------|
| OTP | **אימייל** דרך Resend הקיים. `PortalUser.email` חובה. כניסה: מייל ← קוד 6 ספרות ← session |
| Tier | **Pro בלבד** — feature key `online_classes` ב-`feature-flags.ts` (pro + service_dog, כמו lead_notifications) |
| Branch | `feature/online-classes` (נוצר מ-feature/workshops-ops) |
| מיקום פורטל | `src/app/c/[slug]/` — אותו דפוס כמו `/book`. API תחת `/api/portal/` |
| Slug | אין שדה slug ב-BrandingSettings — משתמשים ב-`Business.slug` |
| טרנזאקציות | **אין interactive $transaction** (Supabase PgBouncer, כלל 17 ב-CLAUDE.md). הרשמה אטומית = `$executeRaw` UPDATE יחיד עם תנאי capacity |
| Prod DDL | additive SQL דרך `prisma db execute --url $DIRECT_URL` — לא `db push` לפרוד. sync ל-schema.production.prisma אחרי כל שינוי |

## ארכיטקטורה

```
פורטל (בעלי כלבים):  src/app/c/[slug]/...       — ציבורי + session פורטל נפרד
API פורטל:            src/app/api/portal/...      — auth עצמאי (portal session cookie)
ניהול (בעל עסק):      src/app/(dashboard)/online-classes/  — TierGate pro
API ניהול:            src/app/api/online-classes/... — requireBusinessAuth רגיל
שכבת שירות:           src/services/online-classes.ts (+ portal-auth ב-src/lib/)
```

- Middleware: להוסיף `/c/` ו-`/api/portal/` ל-PUBLIC_PREFIX_PATHS. Auth של הפורטל נעשה בתוך ה-API routes (portal session), לא ב-edge.
- session פורטל נפרד לגמרי מ-session עסקי — cookie אחר, טבלה/מנגנון לפי דפוס ה-session הקיים.

## סכמת Prisma — מודלים

BrandingSettings (בלי slug), PortalUser (phone unique + email חובה), PortalOtp, PortalSession,
Membership (status: PENDING/ACTIVE/EXPIRED/SUSPENDED, validUntil, paymentNote),
OnlineClass (capacity, spotsTaken אטומי, zoomLink), ClassRegistration (REGISTERED/WAITLIST/CANCELLED, unique פר class+membership),
Course → CourseModule (position ברווחי 10) → Lesson (VIDEO/PDF/TEXT, provider YOUTUBE, videoRef, isFreePreview),
LessonProgress (unique פר membership+lesson).

פירוט מלא בסכמה עצמה — `prisma/schema.prisma` בסוף הקובץ תחת הערת `// ---- Online Classes module ----`.

## לוגיקה קריטית

**הרשמה אטומית (בלי interactive transaction):**
```ts
const claimed: number = await prisma.$executeRaw`
  UPDATE "OnlineClass" SET "spotsTaken" = "spotsTaken" + 1
  WHERE id = ${classId} AND "businessId" = ${businessId} AND "spotsTaken" < capacity`;
// claimed === 1 → צור רישום REGISTERED
// claimed === 0 → צור רישום WAITLIST
// ביטול: UPDATE spotsTaken = spotsTaken - 1 רק אם הרישום היה REGISTERED, ואז קידום הראשון בהמתנה
```

**יוטיוב:** embed דרך `youtube-nocookie.com`, שמירת videoRef בלבד (לא URL מלא).

## ספרינטים

| # | תכולה | סטטוס |
|---|-------|-------|
| 0 | סכמה + DDL + seed לעסק QA + feature flag | |
| 1 | פורטל בסיס: `/c/{slug}` + מיתוג (CSS variables) + middleware | |
| 2 | Auth פורטל: אימייל OTP + session | |
| 3 | זרימת מנוי: בקשה ← אישור בניהול ← וואטסאפ/מייל ללקוח + הוספה ידנית | |
| 4 | שיעורים חיים: CRUD ניהול, קטלוג פורטל, הרשמה אטומית + waitlist | |
| 5 | קורסים: בונה קורסים (dnd-kit) + נגן + התקדמות | |
| 6 | הודעות מתוזמנות: לינק זום שעה לפני, תזכורת פקיעת מנוי (cron קיים + idempotency) | |

**מחוץ לתכולה:** סליקה מובנית, Zoom API, דומיין אישי, חידונים/תעודות, אפליקציה נטיבית.

## כללי עבודה

- כל שאילתה מסוננת `businessId`. UI עברית מלאה, RTL.
- בדיקות live רק על עסק QA (`qa-test@petra.local`).
- אחרי כל שינוי סכמה: `cp prisma/schema.prisma prisma/schema.production.prisma`.
- cron עם idempotency בלבד (סימון sent לפני/אחרי לפי דפוס reminder-service הקיים).
