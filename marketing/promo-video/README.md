# סרטון תדמית — Petra

`petra-promo.mp4` — 58 שניות, 1920×1080, 30fps, ללא סאונד.

מבנה: פתיח → הבעיות (בלגן) → "הכירו את פטרה" → יומן · WhatsApp · לידים · פנסיון · תשלומים · דוחות+AI → נתונים (130+ / 5,000+ / 98%) → CTA petra-app.com.

## עריכה ורינדור מחדש
כל הטקסטים והתזמונים ב-`promo.html` (כל סצנה: `--s` = שנייה התחלה, `--d` = משך; לכל אלמנט `--o` = השהייה בתוך הסצנה).
תצוגה מקדימה בדפדפן: `renderAt(12)` בקונסול מציג את שנייה 12.

```bash
pip install playwright imageio-ffmpeg
# FF / executable_path בתוך render.py — לעדכן לנתיבים המקומיים
python3 render.py stills 5 20 40      # צילומי מסך לבדיקה
python3 render.py video out.mp4       # רינדור מלא
```
