# שלב 1 — תשתית

Commit: `feat(verticals): phase 1 — infra`

## 1.1 סכמה + DDL
- [ ] `Business.vertical String @default("dogs")` (מחרוזת פשוטה, לא enum — כמו `tier`).
- [ ] `TrainingProgram.dogId String?` + `dog Pet?` (נדרש ל"תוכנית" בלי כלב ב-generic).
- [ ] `docs/verticals/ddl-001-business-vertical.sql` — `ADD COLUMN IF NOT EXISTS "vertical" TEXT NOT NULL DEFAULT 'dogs'`.
- [ ] `docs/verticals/ddl-002-training-program-dog-optional.sql` — `ALTER COLUMN "dogId" DROP NOT NULL` (תואם אחורה; שורות קיימות לא משתנות).
- [ ] `cp prisma/schema.prisma prisma/schema.production.prisma`.
- [ ] כל גישה ל-`program.dog.X` / `p.dog.X` בקוד → `?.` (TS יכריח). אין שינוי התנהגות כי לעסקי dogs `dog` תמיד קיים.

## 1.2 lib
- [ ] `src/lib/verticals/index.ts` — `VERTICALS`, `Vertical`, `DEFAULT_VERTICAL`, `normalizeVertical()`,
      `HIDDEN_MODULES`, `isModuleHidden()`, `VERTICAL_SCREENS` (prefix → module), `hiddenScreenFor(vertical, path)`,
      `VERTICAL_API_PREFIXES`, `hiddenApiFor(vertical, path)`, `apiPathMayBeHidden(path)`.
- [ ] `src/lib/verticals/vocab.ts` — `vocab(key, { locale?, vertical?, params? })` + `VocabKey` type; קורא `messages/he.json`.
- [ ] `messages/he.json` — namespace `vocab` (רק המפתחות שהשלב הבא צריך; כל מפתח עם `dogs` + `generic`).
- [ ] `src/lib/verticals/server.ts` — `getBusinessVertical(businessId)`, `verticalNotFound()`.
- [ ] `src/hooks/useVertical.ts` — `{ vertical, isGeneric, v(key, params), hides(module) }`.

## 1.3 חיבור
- [ ] `getCurrentUser()` מחזיר `businessVertical` → `AuthProvider` type.
- [ ] `requireBusinessAuth()` → 404 `{ error: "Not found" }` כש-`hiddenApiFor(vertical, pathname)` (שאילתה רק כשה-path מועמד).
- [ ] `ScreenGuard` (app-shell) → מסך 404 למסך מוסתר.
- [ ] `GET /api/settings` מחזיר `vertical`.

## 1.4 בחירה באונבורדינג
- [ ] `/onboarding` שלב "פרטי עסק": בורר "סוג העסק" — `עסק לחיות מחמד` (ברירת מחדל, מסומן) / `עסק אחר`.
- [ ] `POST /api/onboarding/business` מקבל `vertical` אופציונלי (zod enum). נשמר רק כשהמשתמש owner
      **ולעסק עדיין אין לקוחות** — עסק dogs פעיל לא יכול להחליף ורטיקל בטעות. בלי השדה = אין שינוי.
- [ ] "עסק אחר" נוסף גם ל-`PersonalizationScreen` ול-`StepWelcomeProfile` (קוד לא מחובר, לעקביות).

## 1.5 בדיקות
- [ ] `src/lib/__tests__/verticals.test.ts` — normalize, hidden modules, screen/api matching (dogs לא מסתיר כלום).
- [ ] `src/lib/__tests__/vocab.test.ts` — לכל מפתח יש `dogs` + `generic`; אין "כלב"/"כלבים" ב-generic; params; fallback.

## קריטריוני קבלה
- [ ] `tsc` נקי.
- [ ] `prisma validate` על שני קבצי הסכמה.
- [ ] jest לקבצי הבדיקה החדשים ירוק.
- [ ] עסק בלי `vertical` (= dogs) מקבל אותן תשובות API ואותו סיידבר (vertical לא מסתיר כלום ל-dogs — בדיקת יחידה).
- [ ] עסק generic מקבל 404 על `/api/boarding` ו-`/api/pets`.
- [ ] בחירת "עסק אחר" באונבורדינג שומרת `vertical = "generic"`.
