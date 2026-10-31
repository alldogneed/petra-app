# שלב 2 — מילון והסתרת "נושא" לפי קטגוריות

## 2.1 סריקה
- [ ] להריץ `bash docs/verticals/scan-vocab.sh > docs/verticals/scan-vocab.out.txt` ולשמור את הפלט (commit).
      הסקריפט מסווג כל מופע של כלב / חיות מחמד לפי קטגוריה ומסנן את מה שמחוץ לתכולה
      (כלבי שירות, AllDog, landing, owner, MCP, knowledge מחולל, tests).

## 2.2 סדר עבודה (commit בסוף כל קטגוריה)
`feat(verticals): phase 2 — <קטגוריה>`

1. **ניווט** — `sidebar.tsx` (סינון `hides()`, `nav.training` → "ניהול תוכניות"), `MobileBottomNav`,
   כותרות topbar, `global-search` (לא מחפש/מציג חיות ב-generic).
2. **Pet** — כרטיס לקוח (`PetsSection` + chip/מונה חיות לא מרונדרים), רשימת לקוחות (עמודת/פילטר species),
   `CustomerPicker` (חיפוש לפי שם כלב — רק טקסט placeholder), טופס לקוח חדש בלי שדות כלב.
3. **יומן** — מודל פגישה חדשה / עריכה בלי בוחר כלב; פריטי יומן לא מציגים שם כלב; scheduler.
4. **אימון** — `/training`: כותרות ומונחים דרך `vocab`; יצירת תוכנית בלי כלב (`dogId` null) ב-generic;
   API `POST /api/training-programs` מקבל בלי `dogId` **רק** ב-generic (ב-dogs נשאר חובה).
5. **הודעות** — `STARTER_TEMPLATES` / טקסטים של תבניות בממשק; `appointmentFollowupChain` fallback
   "הכלב שלכם" → ב-generic "הפגישה" (ראו שלב 5 לגבי תבניות Meta).
6. **booking** — `/book/[slug]`: שלב פרטי הכלב לא מוצג ב-generic, API לא דורש כלבים; טקסט תיאור.
7. **אונבורדינג** — טקסט "ברוך הבא" / "מערכת לעסקי חיות מחמד" ו"לקוח ראשון" בלי שדה כלב.
8. **דשבורד** — ווידג'טים `requires: "pets"|"boarding"` מוסתרים; טקסטים.

## כללים
- ענף dogs = הטקסט הקיים תו-בתו (בדיקה: `vocab(key)` שווה למחרוזת שהייתה בקוד).
- "כלב" של כלבי שירות / AllDog / landing — לא נוגעים.
- אם לא ברור אם "כלב" דומייני או של כלבי שירות — לעצור ולשאול.

## קריטריוני קבלה
- [ ] `scan-vocab.out.txt` נשמר.
- [ ] 8 commits לפי הסדר.
- [ ] `tsc` נקי, `prisma validate` ×2.
- [ ] `vocab.test.ts` ירוק (אין "כלב" ב-generic).
- [ ] סריקה חוזרת: כל מופע שנשאר במסלול generic (לקוח → פגישה → תוכנית → תשלום) מוצג רק בתוך ענף `dogs`/מודול מוסתר.
- [ ] עסק dogs: אותם טקסטים ואותם שדות (בדיקה ידנית/יחידה על `vocab` dogs = מקור).
