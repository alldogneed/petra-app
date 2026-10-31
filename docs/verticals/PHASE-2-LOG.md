# שלב 2 — יומן ביצוע

סריקה: `docs/verticals/scan-vocab.out.txt` (621 שורות ב-141 קבצים לפני העבודה).

## 1. ניווט
- `sidebar.tsx` — פריט מוסתר לפי `hidesScreen()` (פנסיון / כלבי שירות / חיות מחמד לא מרונדרים ב-generic, גם לא בקטע "נעול");
  "ניהול תהליכי אילוף" → `vocab("nav.training")` + אייקון `ClipboardList` ב-generic; שאילתת `/api/service-dogs/alerts` כבויה ב-generic.
- `topbar.tsx` — כותרת `/training` מהמילון.
- `global-search.tsx` — placeholder מהמילון (אין חיות ב-generic → אין סקציית חיות).
- לא נגעתי: `app/layout.tsx` + `manifest.ts` (metadata של הנחיתה / SEO — מחוץ לתכולה; כותרת הטאב לעסק generic = שלב 3),
  `SearchModal.tsx` (לא מיובא בשום מקום), `mobile-bottom-nav.tsx` (אין בו טקסט כלבי).
