# תוכנית שיפורים – מערכת ההזמנות האונליין

> קו עיצובי: amber/orange primary, dark sidebar (#0F172A), rounded-xl cards, Hebrew RTL, mobile-first.
> כל תוספת צריכה להיות עקבית עם ה-design system הקיים.

---

## עדיפות 1 – קריטי לפרודקשן

### 1.1 אבטחה: לא לשמור `slug` כמזהה גלוי בלבד
**בעיה:** ה-admin routes משתמשים ב-`DEMO_BUSINESS_ID` hardcoded. בשלב multi-tenant אמיתי נדרש session-based businessId.
**פתרון:**
- Admin routes יקראו `businessId` מה-session (כמו שאר הסיסטם).
- Public `/api/book/[slug]` — בסדר, slug הוא ציבורי במכוון.

### 1.2 אטומיות הזמנה (Double-booking prevention)
**בעיה:** SQLite אינו תומך ב-`SELECT FOR UPDATE`. הבדיקה הנוכחית (re-check לפני insert בתוך transaction) מספקת לרוב המצבים, אך לא מושלמת תחת עומס גבוה.
**פתרון:** להוסיף `@@unique` constraint על `(businessId, startAt)` בטבלת `Booking`, שיגרום ל-Prisma לזרוק שגיאה ייחודית שניתן לתפוס ולהחזיר 409.

```prisma
@@unique([businessId, startAt])  // add to Booking model
```

### 1.3 ולידציה עם Zod
**בעיה:** ה-API routes מבצעים ולידציה ידנית בלבד.
**פתרון:** להוסיף Zod schemas ל-POST `/api/book/[slug]/booking` ו-PUT `/api/admin/availability`.

```typescript
const BookingSchema = z.object({
  serviceId: z.string().uuid(),
  startAt: z.string().datetime(),
  phone: z.string().min(9).max(15),
  customerName: z.string().min(2).optional(),
  dogs: z.array(DogSchema).optional(),
})
```

### 1.4 Rate limiting על Public Booking API
**בעיה:** ה-endpoint הציבורי חשוף ל-spam ו-scraping.
**פתרון:** להשתמש ב-`rateLimit` הקיים (`src/lib/rate-limit.ts`) על `/api/book/[slug]/booking` — מקסימום 5 הזמנות לדקה מאותה IP.

---

## עדיפות 2 – חוויית משתמש קריטית

### 2.1 UX: זיהוי לקוח חלק יותר (Phone lookup API)
**בעיה:** כרגע הלקוח צריך לבחור ידנית "לקוח קיים / חדש".
**שיפור:** הוסף `GET /api/book/[slug]/customer?phone=050...` שמחזיר `{ exists: boolean, name?: string, dogs?: [...] }`. כך:
- אם קיים → מציגים "שלום [שם], בחר/הוסף כלב"
- אם חדש → שדות הרשמה
- **עיצוב:** card עם רקע `amber-50` + checkmark ירוק אם נמצא, בסגנון הקיים.

### 2.2 Pre-select dog אם יש רק אחד
**בעיה:** אם ללקוח כלב אחד, למה לבחור?
**שיפור:** כשה-customer lookup מחזיר כלב אחד — בחר אותו אוטומטית. אם יש יותר — הראה רשימת checkboxes בסגנון `border-2 border-amber-300 rounded-xl`.

### 2.3 הצגת ימים בלוח שנה: disabled vs. open
**בעיה נוכחית:** ימים סגורים מוצגים אפורים אבל לא ברור מדוע.
**שיפור:**
- הוסף tooltip (title attribute) "יום סגור" על ימים אפורים.
- סמן את היום הנוכחי בגבול כחול עדין (`ring-2 ring-blue-200`).
- כשמחזירים 0 slots ביום שנבחר — הצג "אין זמינות ביום זה. [רוצה לקבל התראה?]" עם `CalendarOff` icon.

### 2.4 הוסף שלב "הכן לי תאריכים" - Next Available
**שיפור:** כפתור "הצג את הפגישה הקרובה הזמינה" שמחפש אוטומטית ב-7 ימים הבאים ומציג את הראשון שיש בו slots.

---

## עדיפות 3 – שיפורי Admin Panel

### 3.1 Settings page – הוסף לשונית "Online Booking" לשירותים
**בעיה:** אין UI לשנות `isPublicBookable`, `bookingMode`, `bufferBefore/After`, `depositRequired` לשירות.
**שיפור:** בדף `/settings` (שלשונית שירותים), הרחב את ה-card של כל שירות:

```
┌─────────────────────────────────────┐
│ 🐾 טיפוח מלא · 90 דק · ₪250       │
│                                      │
│  [✓] זמין להזמנה אונליין            │
│  אופן אישור: [אוטומטי ▼]            │
│  חיץ לאחר: [15 דק ▼]               │
│  פיקדון: [___ ₪]                    │
└─────────────────────────────────────┘
```

### 3.2 Admin Bookings – הוסף Badge עם ספירת pending
**שיפור:** בסיידבר, הוסף `badge` אדום עם מספר ההזמנות הממתינות ליד "הזמנות אונליין":

```typescript
// בסיידבר:
{ name: "הזמנות אונליין", href: "/bookings", icon: CalendarCheck, badgeKey: "pending_bookings" }
```

API: `GET /api/admin/bookings/count?status=pending` מחזיר `{ count: number }`.

### 3.3 Admin Availability – Service-specific hours
**שיפור עתידי:** כרגע זמינות היא per-business. אפשר להוסיף `serviceId` אופציונלי ל-`AvailabilityRule` — שירות "אילוף" זמין רק בבקרים, "טיפוח" כל היום.

### 3.4 לוח שנה מאוחד – הצג Bookings ב-Calendar הקיים
**שיפור:** הוסף ל-`/calendar` אפשרות להציג גם `Booking` (מה-booking table) לצד `Appointment` הקיים, עם צבע שונה (e.g., `amber-300` vs. `blue-300`).

---

## עדיפות 4 – Notifications (stub → אמיתי)

### 4.1 WhatsApp / SMS integration
**המלצה:**
- **WhatsApp:** Twilio API או 360dialog (נפוץ בישראל).
- **SMS:** Inforu / Vonage.
- הפונקציות `notifyCustomerConfirmed`, `notifyOwnerNewPending` כבר קיימות כ-stubs ב-`/api/book/[slug]/booking/route.ts`.

**Schema:**
```prisma
model NotificationLog {
  id         String   @id @default(uuid())
  bookingId  String
  channel    String   // "whatsapp" | "sms" | "email"
  to         String
  templateId String?
  status     String   @default("pending")
  sentAt     DateTime?
  createdAt  DateTime @default(now())
}
```

### 4.2 תזכורת 24 שעות לפני
**שיפור:** Cron job / Next.js scheduled function שסורקת bookings שעומדות ל-24 שעות ושולחת תזכורת ללקוח.

---

## עדיפות 5 – Payment Integration

### 5.1 Deposit Flow
כרגע `depositRequired` נשמר אבל אין payment flow.

**המלצה לשלב V1.5:**
- **Tranzila / Cardcom** (נפוץ בישראל) לתשלום מקוון.
- Flow: לאחר בחירת slot → אם `depositRequired` → redirect ל-payment provider → callback → `booking.depositPaid = true` → status = confirmed.
- **Schema:** הוסף `depositPaymentRef String?` ל-Booking.

---

## עדיפות 6 – עיצוב ו-Polish

### 6.1 Booking Page – אנימציות מעבר בין שלבים
כרגע המעבר בין שלבים הוא מיידי. הוסף:
```typescript
// transition on step change
<div className={cn("transition-all duration-200", entering ? "opacity-100" : "opacity-0")}>
```

### 6.2 Loading skeleton במקום spinner
השתמש ב-`skeleton` (כבר בshadcn) עבור טעינת slots:
```tsx
// במקום spinner:
<div className="grid grid-cols-3 gap-2">
  {Array(6).fill(0).map((_, i) => (
    <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
  ))}
</div>
```

### 6.3 Success Page – Add to Calendar
לאחר אישור הזמנה, הצג כפתור "הוסף ליומן Google":
```
https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...
```

### 6.4 Dark Mode
ה-design system הנוכחי הוא light-only. כשיוחלט להוסיף dark mode — כל ה-booking page עם `amber-50` backgrounds יצטרך `dark:bg-amber-950` equivalents.

---

## תוכנית בדיקות נוספות (Testing Roadmap)

| סוג | קיים עכשיו | מה להוסיף |
|-----|-----------|-----------|
| Unit – slots engine | ✅ 48 tests | - |
| Unit – booking validation | ✅ 14 tests | Zod schema tests |
| Unit – permissions | ✅ 18 tests | - |
| Unit – order-calc | ✅ 29 tests | - |
| Integration – booking API | ⏳ (mock-based) | E2E with test DB |
| E2E – booking wizard | ❌ | Playwright tests |
| Load test – double-booking | ❌ | k6 / Artillery concurrent requests |

---

## סיכום עדיפויות

```
ASAP (לפני לקוחות אמיתיים):
  ✦ 1.2 Unique constraint on (businessId, startAt)
  ✦ 1.3 Zod validation
  ✦ 1.4 Rate limiting
  ✦ 2.1 Phone lookup API

V1.5 (חודש-חודשיים):
  ✦ 3.1 Settings UI for booking fields
  ✦ 3.2 Pending badge in sidebar
  ✦ 4.1 WhatsApp/SMS notifications
  ✦ 5.1 Deposit payment

V2 (רבעון הבא):
  ✦ 2.4 Next Available
  ✦ 3.3 Service-specific availability
  ✦ 3.4 Unified calendar view
  ✦ 6.3 Add to Calendar
  ✦ Load testing
```
