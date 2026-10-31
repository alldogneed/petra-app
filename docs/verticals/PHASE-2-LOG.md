# שלב 2 — יומן ביצוע

סריקה: `docs/verticals/scan-vocab.out.txt` (621 שורות ב-141 קבצים לפני העבודה).

## 1. ניווט
- `sidebar.tsx` — פריט מוסתר לפי `hidesScreen()` (פנסיון / כלבי שירות / חיות מחמד לא מרונדרים ב-generic, גם לא בקטע "נעול");
  "ניהול תהליכי אילוף" → `vocab("nav.training")` + אייקון `ClipboardList` ב-generic; שאילתת `/api/service-dogs/alerts` כבויה ב-generic.
- `topbar.tsx` — כותרת `/training` מהמילון.
- `global-search.tsx` — placeholder מהמילון (אין חיות ב-generic → אין סקציית חיות).
- לא נגעתי: `app/layout.tsx` + `manifest.ts` (metadata של הנחיתה / SEO — מחוץ לתכולה; כותרת הטאב לעסק generic = שלב 3),
  `SearchModal.tsx` (לא מיובא בשום מקום), `mobile-bottom-nav.tsx` (אין בו טקסט כלבי).

## 2. Pet
- כרטיס לקוח: `PetsSection` + chip "חיות" לא מרונדרים ב-generic; הדרישה "חובה להוסיף חיית מחמד לפני הזמנה" לא חלה;
  כפתור "טופס קבלה" מוסתר (טופס הקליטה הוא טופס לכלב → `/intake*` צורפו למודול `pets` המוסתר, גם ה-API);
  שיוך חוזה לכלב מוסתר; הודעת מעקב אחרי תור מהמילון.
- רשימת לקוחות: עמודת "חיות" + `PetsCell` במובייל מוסתרים; פילטר "סוג חיה" מוסתר; פילטר "סוג שירות" בלי טיפוח / פנסיון / דיי קר
  (`isServiceTypeOffered`) ו"אילוף" → "מפגשים ותוכניות"; הודעת ברוכים הבאים + placeholder להודעה קבוצתית + אזהרת מחיקה מהמילון.
- `CustomerPicker` — placeholder מהמילון.
- `CreateOrderModal` (המסלול לתשלום): ב-generic אין דרישת חיה; קטגוריות = מפגשים וחבילות + מוצרים (`src/lib/verticals/catalog.ts`,
  הקטגוריה נשמרת "אילוף" — מפתח); סוגי הזמנה = מפגש בודד / חבילת מפגשים (בלי פנסיון / קבוצה); `programType = CUSTOM`.
- `createOrder()` (שרת): הזמנת מפגש / חבילה של עסק generic בלי חיה פותחת `TrainingProgram` עם `dogId = null`. ב-dogs: אותו כלל (אין חיה → אין תוכנית);
  ה-vertical נקרא רק כשהכלל הישן היה מדלג.
- ייצוא לקוחות: בלי עמודות חיה ב-generic.
- בדיקה: `vocab-dogs-parity.test.ts` — ענף dogs של כל מפתח = הטקסט שהיה בקוד, ומכריח להוסיף כל מפתח חדש.
- נדחה לשלב 5: `payment-request.ts` + `PaymentRequestDialog` (גוף הודעת WhatsApp "שלום X! 🐾").

## 3. יומן
- `calendar/page.tsx`: ב-generic הקטגוריות תספורת / פנסיון / אילוף בפנסיון / אילוף קבוצתי לא מוצעות; "אילוף מקצועי" → "תוכניות",
  "אילוף בבית הלקוח" → "מפגשי תוכנית"; פריטי מפגש (🐕 / "אילוף:") מהמילון; שאילתת `/api/boarding` כבויה; מודל תור חדש —
  קבוצות מחירון לפי `offeredPriceCategories` + תווית, "לשייך לחבילה", הערת ברירת מחדל "מפגש"; הודעות WhatsApp (תזכורת / לינק לתור הבא) בלי 🐾.
- `scheduler/page.tsx`: בחירת חיה לא מרונדרת ב-generic; "לשייך לחבילה"; הודעת אישור בלי 🐾.
- `bookings/page.tsx`: הודעת אישור הזמנה מהמילון (רשימת "כלבים" מוצגת רק כשיש כלבים — לא קיים ב-generic).
- `google-calendar.ts`: אירוע הזמנה — אייקון שירות לפי ורטיקל (`business.vertical` נוסף ל-select); מפגש תוכנית בלי נושא (רק generic) בלי "כלב"/"אילוף".
- `orders/[id]`: סוג הזמנה "🐕 אילוף" מהמילון.
- כבר מותנים בקיום חיות (לא נגעתי): מודלי תור בדשבורד ובכרטיס לקוח, hover preview ביומן.
- נדחה לשלב 5: `/api/appointments/[id]/remind` (free-text בשרת).

## 4. אימון
- **החלטה:** `training/page.tsx` (7,300 שורות, טאבים של פנסיון / קבוצות / כלבי שירות, `program.dog.name` בכל כרטיס) לא נוגעים בו —
  עסקי dogs ממשיכים לראות בדיוק אותו מסך. ב-generic `/training` מציג `GenericProgramsView` (`src/components/training/`):
  אותו מודול, אותו API, אותן שורות `TrainingProgram` — לקוח, שם, כמות מפגשים, מחיר, התקדמות, "תיעוד מפגש", "סיום תוכנית".
- `POST /api/training-programs` בלי `dogId`: dogs → 400 "יש לבחור כלב" (כמו היום); generic → חובה `customerId`, `HOME`, `CUSTOM`, `dogId = null`.
  `createTrainingProgram()` מדלג על בדיקת הכלב רק כש-`dogId` null.
- כרטיס לקוח `PackageTracking`: תוכנית בלי נושא מציגה את שמה (לא "מותאם אישית").
- בדיקה חיה: יצירה ב-generic → 201 (`dogId` null, CUSTOM); תיעוד מפגש → 201; dogs בלי כלב → 400; הזמנת חבילה ב-generic → תוכנית 10 מפגשים מקושרת להזמנה; dogs בלי כלב → אין תוכנית.
- לא בתכולה: הודעות שגיאה בשרת שמזכירות "תוכנית אילוף" (לא "כלב"), קבוצות אילוף (לא נגישות ב-generic), MCP.

## 5. הודעות (ממשק)
- `messages-panel.tsx`: גופי תבניות הפתיחה (`STARTER_TEMPLATES`) עברו למילון (`starter.*`, ענף dogs = הטקסט הקודם — בדיקת שוויון).
  ב-generic: אין תבניות / טריגרים של יום הולדת לחיה ופנסיון (`DOG_ONLY_TRIGGERS`), והשאר בלי 🐾 ו-`{petName}`.
  עסק dogs מקבל את אותו מערך (`STARTER_TEMPLATES = buildStarterTemplates("dogs")`).
- `PaymentRequestDialog`: פתיח ההודעה מהמילון.
- הודעות שהשרת שולח (`reminder-service.ts`, `payment-request.ts`, `/api/appointments/[id]/remind`, תבניות Meta) — שלב 5.
- `training/page.tsx` (הודעות "עדכון אימון עבור <כלב> 🐾") — מסך dogs בלבד, generic לא מגיע אליו.

## 6. booking
- `GET /api/book/[slug]` מחזיר `vertical`. `/book/[slug]` ב-generic: אין שלב "כלבים" (גם לא במחוון השלבים), "המשך" מפרטים → אישור,
  "פרטי בעל הכלב" / "בעל הכלב" מהמילון, אין בלוק כלבים באישור, אייקון שירות כללי (`CalendarCheck`), כותרת הטאב של שלב הכלבים לא קיימת.
- `book/[slug]/layout.tsx` — meta description מהמילון.
- `POST /api/book/[slug]/booking`: `dogs` כבר אופציונלי; ב-generic הזמנה של שירות "אילוף" (= מפגשים וחבילות) בלי כלב פותחת תוכנית ללקוח
  (`dogId` null). dogs: אותו כלל (אין כלב → אין תוכנית).
- בדיקה חיה: slots ל-generic → 200; הזמנה בלי כלבים → 201 confirmed, תור בלי חיה, תוכנית בלי כלב.
- לא נגעתי: טופס הקליטה הציבורי `/intake/[token]` (המודול מוסתר ב-generic, אין דרך ליצור טופס), `/my-booking` (בלוק "כלבים" רק כשיש כלבים).
- לוגו פטרה / "Petra" בעמוד ההזמנה — שלב 3.
