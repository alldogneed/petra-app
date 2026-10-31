# שלב 1 — תשתית

Commit: `feat(verticals): phase 1 — infra`

## 1.1 סכמה + DDL
- [x] `Business.vertical String @default("dogs")` (מחרוזת פשוטה, לא enum — כמו `tier`).
- [x] `TrainingProgram.dogId String?` + `dog Pet?` (נדרש ל"תוכנית" בלי כלב ב-generic).
- [x] `docs/verticals/ddl-001-business-vertical.sql` — `ADD COLUMN IF NOT EXISTS "vertical" TEXT NOT NULL DEFAULT 'dogs'`.
- [x] `docs/verticals/ddl-002-training-program-dog-optional.sql` — `ALTER COLUMN "dogId" DROP NOT NULL` (תואם אחורה; שורות קיימות לא משתנות).
- [x] `cp prisma/schema.prisma prisma/schema.production.prisma`.
- [x] כל גישה ל-`program.dog.X` / `p.dog.X` בקוד → `?.` (TS יכריח). אין שינוי התנהגות כי לעסקי dogs `dog` תמיד קיים.

## 1.2 lib
- [x] `src/lib/verticals/index.ts` — `VERTICALS`, `Vertical`, `DEFAULT_VERTICAL`, `normalizeVertical()`,
      `HIDDEN_MODULES`, `isModuleHidden()`, `VERTICAL_SCREENS` (prefix → module), `hiddenScreenFor(vertical, path)`,
      `VERTICAL_API_PREFIXES`, `hiddenApiFor(vertical, path)`, `apiPathMayBeHidden(path)`.
- [x] `src/lib/verticals/vocab.ts` — `vocab(key, { locale?, vertical?, params? })` + `VocabKey` type; קורא `messages/he.json`.
- [x] `messages/he.json` — namespace `vocab` (רק המפתחות שהשלב הבא צריך; כל מפתח עם `dogs` + `generic`).
- [x] `src/lib/verticals/server.ts` — `getBusinessVertical(businessId)`, `verticalNotFound()`.
- [x] `src/hooks/useVertical.ts` — `{ vertical, isGeneric, v(key, params), hides(module) }`.

## 1.3 חיבור
- [x] `getCurrentUser()` מחזיר `businessVertical` → `AuthProvider` type.
- [x] `requireBusinessAuth()` → 404 `{ error: "Not found" }` כש-`hiddenApiFor(vertical, pathname)` (שאילתה רק כשה-path מועמד).
- [x] `ScreenGuard` (app-shell) → מסך 404 למסך מוסתר.
- [x] `GET /api/settings` מחזיר `vertical`.

## 1.4 בחירה באונבורדינג
- [x] `/onboarding` שלב "פרטי עסק": בורר "סוג העסק" — `עסק לחיות מחמד` (ברירת מחדל, מסומן) / `עסק אחר`.
- [x] `POST /api/onboarding/business` מקבל `vertical` אופציונלי (zod enum). נשמר רק כשהמשתמש owner
      **ולעסק עדיין אין לקוחות** — עסק dogs פעיל לא יכול להחליף ורטיקל בטעות. בלי השדה = אין שינוי.
- [x] "עסק אחר" נוסף גם ל-`PersonalizationScreen` ול-`StepWelcomeProfile` (קוד לא מחובר, לעקביות).

## 1.5 בדיקות
- [x] `src/lib/__tests__/verticals.test.ts` — normalize, hidden modules, screen/api matching (dogs לא מסתיר כלום).
- [x] `src/lib/__tests__/vocab.test.ts` — לכל מפתח יש `dogs` + `generic`; אין "כלב"/"כלבים" ב-generic; params; fallback.

## קריטריוני קבלה
- ✅ `tsc` נקי.
- ✅ `prisma validate` על שני קבצי הסכמה (זהים).
- ✅ jest לקבצי הבדיקה החדשים ירוק (64). החבילה המלאה: 1393 עוברים; 22 כישלונות ב-`order-calc` + `booking-engine` קיימים גם ב-main בלי השינוי.
- ✅ dogs: `HIDDEN_MODULES.dogs = []` (בדיקת יחידה) + בדיקה חיה (Postgres מקומי + `next dev`): `/api/boarding/rooms`, `/api/pets`, `/api/feeding`, `/api/medications`, `/api/service-dogs` → 200 לעסק dogs.
- ✅ generic: אותם 5 נתיבים → 404 (בדיקה חיה); `/api/customers`, `/api/training-programs` → 200.
- ✅ `POST /api/onboarding/business {vertical:"generic"}` שומר generic; `vertical:"cats"` → 400; עסק dogs עם לקוח → נשאר dogs (בדיקה חיה).
- ✅ DDL: הורץ פעמיים על DB בסכמת main הישנה — עסק קיים קיבל `dogs`, `prisma migrate diff` מול הסכמה החדשה = "No difference detected".
- ✅ `audit-route-auth` + `audit-whatsapp-free-text` ירוקים.
