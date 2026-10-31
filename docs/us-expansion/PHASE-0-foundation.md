# שלב 0 — תשתית i18n + פיילוט (הוראות עבודה ל‑Claude Code)

**תוכנית‑אם:** `docs/us-expansion-plan.md` (לקרוא קודם, במיוחד §3 ו‑§5).
**Branch:** `feature/i18n-foundation` מ‑`origin/main`.
**מטרה:** להניח את כל התשתית ולהוכיח את השיטה על עמוד אחד — בלי שינוי כלשהו למה שמשתמש עברי רואה.

> כללי CLAUDE.md בתוקף: Node PATH (#1), dev server בנתיב עברי (#2), PostCSS לא מעדכנים (#3), `schema.production.prisma` אחרי כל שינוי סכמה (#4). `tsc` מלא נתקע על המכונה — להריץ scoped.

---

## שלב 0.1 — הכנה
- [ ] `git fetch origin && git checkout -b feature/i18n-foundation origin/main`
- [ ] לוודא `git status` נקי. לא לגעת ב‑`feature/online-classes`.
- [ ] `PATH="/Users/or-rabinovich/local/node/bin:$PATH" npm install next-intl@^3 libphonenumber-js`
      (next-intl 3.x תואם Next 14.2; **לא** להתקין 4.x. לא לגעת ב‑postcss.)

## שלב 0.2 — סכמה (additive בלבד)
- [ ] להוסיף ל‑`model Business` ב‑`prisma/schema.prisma`, אחרי `timezone`:
  ```prisma
  locale           String @default("he-IL")
  country          String @default("IL")
  currency         String @default("ILS")
  messagingChannel String @default("whatsapp")
  billingProvider  String @default("cardcom")
  ```
- [ ] `cp prisma/schema.prisma prisma/schema.production.prisma`
- [ ] ליצור `prisma/us_expansion_phase0.sql`:
  ```sql
  ALTER TABLE "Business"
    ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'he-IL',
    ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'IL',
    ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'ILS',
    ADD COLUMN IF NOT EXISTS "messagingChannel" TEXT NOT NULL DEFAULT 'whatsapp',
    ADD COLUMN IF NOT EXISTS "billingProvider" TEXT NOT NULL DEFAULT 'cardcom';
  ```
  (מריצים ב‑prod עם `prisma db execute --url $DIRECT_URL` — **רק אור מריץ ב‑prod**, לא הסוכן.)
- [ ] `npx prisma generate` (עם PATH).
- [ ] `src/lib/locale.ts` — מקור אמת יחיד:
  ```ts
  export const LOCALES = ["he-IL", "en-US"] as const;
  export type Locale = typeof LOCALES[number];
  export const DEFAULT_LOCALE: Locale = "he-IL";
  export const LOCALE_CONFIG: Record<Locale, { lang: "he"|"en"; dir: "rtl"|"ltr"; currency: "ILS"|"USD"; country: "IL"|"US"; dateFnsLocale: "he"|"enUS"; hourCycle: "h23"|"h12" }> = { ... };
  export function isLocale(x: unknown): x is Locale
  export function localeFromBusiness(b: { locale?: string | null }): Locale  // fallback he-IL
  ```
- [ ] `FullSession` (`src/lib/session.ts`): לוודא שהעסק הפעיל בסשן חושף `locale` (אם ה‑session כבר טוען את ה‑Business — להוסיף את השדה ל‑select; אם לא — להוסיף `businessLocale` ל‑membership הפעיל). לא לשנות auth logic.

## שלב 0.3 — next-intl (ללא routing לדשבורד)
הדשבורד **לא** מקבל prefix בנתיב — ה‑locale מגיע מהעסק. לכן משתמשים ב‑next-intl במצב "without i18n routing":
- [ ] `src/i18n/request.ts` — `getRequestConfig` שמחזיר `{ locale, messages }`; ה‑locale נקבע כך:
  1. אם יש session עם עסק → `localeFromBusiness`.
  2. אחרת (דפים ציבוריים/שיווק) → cookie `NEXT_LOCALE` אם קיים, אחרת `he-IL`.
  (prefix `/en/` לדפי שיווק = שלב 7, לא עכשיו.)
- [ ] `next.config.mjs` — לעטוף ב‑`createNextIntlPlugin("./src/i18n/request.ts")`. **לא** לגעת ב‑`config.cache = memory` (#24) וב‑CSP.
- [ ] `messages/he.json`, `messages/en.json` — מתחילים עם namespaces `common` ו‑`tasks` בלבד.
- [ ] `src/app/layout.tsx`: `<html lang={cfg.lang} dir={cfg.dir}>` + `NextIntlClientProvider` עם ה‑messages. Heebo נשאר לעברית; להוסיף `Inter` מ‑`next/font/google` לאנגלית — משתנה `--font-sans` נבחר לפי locale. Toaster `fontFamily` לפי locale.
- [ ] `(dashboard)/layout.tsx`: אין שינוי מבני; לוודא שה‑provider מהשורש מגיע.

## שלב 0.4 — פורמטים
- [ ] `src/lib/format.ts` (חדש):
  - `formatCurrency(amount, { locale, currency })` → `Intl.NumberFormat`
  - `formatDate(d, { locale, timezone, style? })`, `formatTime(d, { locale, timezone })` → `Intl.DateTimeFormat` עם `hourCycle` מ‑`LOCALE_CONFIG`
  - `formatPhone(phone, country)` / `validatePhone(phone, country)` / `toE164(phone, country)` → `libphonenumber-js`
- [ ] `src/lib/utils.ts`: `formatCurrency/formatDate/formatTime` הקיימות **נשארות** עם חתימה זהה ומאצילות ל‑`format.ts` עם `he-IL`/`ILS`/`Asia/Jerusalem` — כך 0 רגרסיה. מסומנות `@deprecated use format.ts with business locale` (ההחלפה בכל הקוראים = שלב 4).
- [ ] `src/lib/validation.ts`: `validateIsraeliPhone` נשאר; להוסיף `validatePhoneForCountry(phone, country)` שמחזיר הודעת שגיאה דרך `t("errors.phoneInvalid")`.
- [ ] hook קליינט `useBusinessLocale()` (`src/hooks/`) — מחזיר `{ locale, currency, timezone, country, cfg }` מתוך `useAuth().user.business` (להוסיף את השדות ל‑`/api/auth/me` או היכן ש‑`useAuth` ניזון; **לא** להוסיף `platformRole` — #11).

## שלב 0.5 — כלים
- [ ] `scripts/check-no-hebrew.ts` — סורק קבצים ברשימה `scripts/i18n-migrated.txt` (glob per line); נכשל אם יש תו ב‑`֐–׿` מחוץ ל‑`messages/`. להוסיף `"check:i18n"` ל‑package.json. מתחילים עם `src/app/(dashboard)/tasks/page.tsx` ברשימה.
- [ ] `scripts/codemod-logical-css.mjs` — החלפה ב‑className strings בלבד (string literal ו‑template literal), כולל variants (`md:ml-4` → `md:ms-4`, `hover:`, `rtl:` וכו'):
  `ml-→ms-`, `mr-→me-`, `pl-→ps-`, `pr-→pe-`, `left-→start-`, `right-→end-`, `text-left→text-start`, `text-right→text-end`, `rounded-l→rounded-s`, `rounded-r→rounded-e` (כולל `-tl/-tr/-bl/-br` → `-ss/-se/-es/-ee`), `border-l→border-s`, `border-r→border-e`, `inset-x` לא נוגעים, `scroll-ml/mr`, `space-x` (לא משתנה — Tailwind מטפל ב‑RTL עם `space-x-reverse`; אם מצאת `space-x-reverse` תשאיר).
  - מדלג על שורות עם הערה `// rtl-ok` או קלאס בתוך אלמנט עם `dir="ltr"`.
  - `--dry-run` מדפיס diff; `--write` כותב. מקבל נתיבים כארגומנטים.
  - ⚠️ `left-`/`right-` משמשים גם למיקום מוחלט (`absolute left-0`) — ההחלפה ל‑`start-0`/`end-0` נכונה גם שם; `translate-x` ו‑`rotate` **לא** נוגעים — אלה לא כיווניים ב‑Tailwind, יסומנו לבדיקה ידנית ב‑QA.
- [ ] `scripts/extract-hebrew.mjs` — עוזר (לא חובה שיהיה מושלם): מדפיס לכל קובץ את כל ה‑JSX text / string literals עם עברית + מספר שורה, כ‑JSON — כדי שהסוכן ימלא `he.json` תו‑בתו ולא יקליד מחדש.

## שלב 0.6 — פיילוט: `src/app/(dashboard)/tasks/page.tsx` (233 שורות עברית)
- [ ] להריץ `extract-hebrew` על הקובץ → לבנות `messages/he.json` namespace `tasks` (+ מה שמשותף ל‑`common`: שמור/בטל/מחק/חיפוש/טוען…). **הטקסט העברי זהה תו‑בתו למקור.** ICU ל‑plurals (`{count, plural, one {משימה אחת} other {# משימות}}`).
- [ ] לכתוב `messages/en.json` תואם — אנגלית אמריקאית, לפי המילון ב‑§6 של התוכנית‑האם (Client, Appointment…).
- [ ] להחליף בקובץ: `useTranslations("tasks")`, `useFormatter` / `formatDate` מ‑`format.ts` עם `useBusinessLocale()`; `import { he } from "date-fns/locale"` → locale דינמי.
- [ ] להריץ `codemod-logical-css --write` על הקובץ, לעבור ידנית על אייקוני חיצים (`ChevronLeft/Right`, `ArrowRight`) → `rtl:rotate-180` או `<DirIcon>` ב‑`src/components/ui/DirIcon.tsx` (חדש, קטן).
- [ ] אם הקומפוננטות שהעמוד משתמש בהן (`PageTitle`, modal, selection bar) מכילות עברית משלהן — להוסיף **רק** אותן לפיילוט, לא לגלוש.
- [ ] `npm run check:i18n` ירוק.

## שלב 0.7 — אימות (שער יציאה)
- [ ] `tsc` scoped: `npx tsc --noEmit -p tsconfig.json --incremental false` על הקבצים שהשתנו (או `tsc --noEmit` עם `files` מצומצם) — לא מלא.
- [ ] dev server (#2). עסק QA ישראלי (`qa-test@petra.local`): עמוד tasks **זהה** לפני/אחרי. Playwright: צילום `before.png` מ‑`origin/main` (worktree נפרד) ו‑`after.png` מה‑branch, 1440×900 + 390×844, השוואה פיקסלית (סף ≤0.5%). לשמור ב‑`docs/us-expansion/qa/phase0/`.
- [ ] לשנות זמנית ב‑DB המקומי `locale='en-US'` לעסק QA → עמוד tasks באנגלית, LTR, Inter, תאריכים MM/dd, 12h. צילום `after-en.png`. להחזיר ל‑`he-IL`.
- [ ] שאר הדשבורד (שלא הוגר) עדיין עברי ו‑RTL תקין גם כש‑`locale='en-US'`? — **צפוי שלא** (עברית קשיחה בתוך `dir=ltr`). זה מקובל בשלב 0; לתעד screenshot אחד ב‑QA כהוכחה שה‑dir מתחלף, ולא לתקן.
- [ ] Vercel preview build עובר.
- [ ] סקירת אבטחה read-only (subagent): אין `platformRole` בקליינט, אין locale מהבקשה שגובר על העסק, middleware לא השתנה, `/api/mcp` עדיין ב‑`PUBLIC_EXACT_PATHS`.
- [ ] לעדכן: `docs/i18n.md` (חדש, קצר: איך מוסיפים מחרוזת, איך מריצים codemod/check), ו‑CLAUDE.md — סעיף "i18n" עם הכלל: אין `he-IL`/`ILS`/`Asia/Jerusalem`/`₪` קשיח, אין עברית ב‑src מחוץ ל‑messages בקבצים מוגרים.
- [ ] PR ל‑main עם תיאור + screenshots. **לא לעשות merge בלי אישור אור.**

## מה לא עושים בשלב 0
- לא נוגעים בשום עמוד מלבד tasks (והקומפוננטות הישירות שלו).
- לא מחליפים קריאות `formatCurrency` ברחבי הקוד (שלב 4).
- לא נוגעים ב‑API routes, cron, WhatsApp, Cardcom, MCP.
- לא מוסיפים UI לבחירת שפה בהגדרות (יגיע בשלב 3 עם ההרשמה).

## דיווח בסיום
קובץ `docs/us-expansion/PHASE-0-report.md`: מה נעשה, סטיות מההוראות ולמה, ממצאי codemod (כמה החלפות, אילו חריגים), כמה מחרוזות חולצו, זמן ריצה, ומה לומדים לקראת גלי שלב 1 (למשל: אילו דפוסים חוזרים ב‑JSX מקשים על החילוץ).
