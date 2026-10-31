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
