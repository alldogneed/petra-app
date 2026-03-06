# Petra — Project Handoff Document

> עדכון אחרון: מרץ 2026
> מצב: פרודקשן פעיל — [petra-app.com](https://petra-app.com)
> Repo: `alldogneed/petra-app` (GitHub) · Vercel: alldogneed-9395s-projects · DB: Neon.tech

---

## 1. מה זה פטרה?

SaaS לניהול עסקי חיות מחמד בישראל — מאמני כלבים, פנסיונות, מספרות.
ממשק בעברית מלאה, RTL, multi-tenant (כל עסק מבודד לחלוטין).

---

## 2. Tech Stack

| שכבה | טכנולוגיה |
|------|-----------|
| Framework | Next.js 14 App Router + TypeScript |
| UI | Tailwind CSS + shadcn/ui (new-york style) + Heebo font |
| DB prod | PostgreSQL — Neon.tech |
| DB dev | SQLite |
| ORM | Prisma (`prisma/schema.prisma`) |
| State | React Query v5 (`@tanstack/react-query`) |
| Auth | Email+bcryptjs + Google OAuth — cookie `petra_session` (7 ימים) |
| Icons | lucide-react |
| Toasts | sonner |
| Email | Resend |
| WhatsApp | Twilio |
| Deploy | Vercel (git push → auto-deploy) |
| Scheduling | Vercel Cron (4 daily jobs) |

---

## 3. Environment — הגדרות קריטיות

### Node.js
Node v20.11.1 נמצא ב-`/Users/or-rabinovich/local/node/bin/` ואינו ב-PATH.
**כל פקודה חייבת prefix:**
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma generate
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npm install
```

### Dev Server
`npm run dev` נכשל — הנתיב לפרויקט מכיל תווים עבריים.
```bash
(export PATH="/Users/or-rabinovich/local/node/bin:$PATH"; cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app'; node node_modules/.bin/next dev) > /tmp/petra-dev.log 2>&1 &
```

### TypeScript Check
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node /Users/or-rabinovich/Desktop/פיתוח/petra-app/node_modules/.bin/tsc --noEmit --project /Users/or-rabinovich/Desktop/פיתוח/petra-app/tsconfig.json
```

### Deploy לפרודקשן
```bash
git add <files>
git commit -m "feat/fix: ..."
git push origin main
vercel --prod
```

---

## 4. קבצי .env נדרשים

```env
DATABASE_URL="postgresql://..."            # Neon connection pool URL
DIRECT_URL="postgresql://..."             # Neon direct URL (חובה עם connection pooling)
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="https://petra-app.com/api/auth/google/callback"
APP_URL="https://petra-app.com"
GCAL_REDIRECT_URI="https://petra-app.com/api/integrations/google/callback"
GCAL_ENCRYPTION_KEY=""                    # openssl rand -hex 32
INVOICING_ENCRYPTION_KEY=""
STRIPE_ENCRYPTION_KEY=""
NEXT_PUBLIC_APP_URL="https://petra-app.com"
CRON_SECRET=""                            # Bearer token לקרון
RESEND_API_KEY=""                         # ⚠️ חסר! → resend.com → API Keys
EMAIL_FROM="Petra <onboarding@resend.dev>"
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_WHATSAPP_FROM="+14155238886"
MAKE_WEBHOOK_SECRET=""
WEBHOOK_BUSINESS_ID="6c51668f-00e9-46b1-9ba2-ff113831a172"
```

---

## 5. Auth & Multi-tenant

### כלל ברזל
כל API route מוגן מוציא `businessId` **מהסשן בלבד**. אף פעם לא hardcode.

```typescript
export const dynamic = 'force-dynamic';
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  const auth = await requireBusinessAuth(request);
  if (isGuardError(auth)) return auth;
  const { businessId } = auth;
  // ...
}
```

### Guards זמינים (`src/lib/auth-guards.ts`)
| Guard | מתי להשתמש |
|-------|------------|
| `requireBusinessAuth` | כל route של טנאנט — מחזיר `{ session, businessId }` |
| `requireAuth` | session בלבד, ללא business context |
| `requirePlatformPermission` | פעולות admin פלטפורמה |
| `isGuardError` | type-narrow לבדיקה אם חזרה שגיאה |

### חשבונות טסט (demo-business-001)
| Email | Password | Role |
|-------|----------|------|
| `owner@petra.local` | `Admin1234!` | owner |
| `admin@petra.local` | `Admin1234!` | admin |
| `superadmin@petra.local` | `Admin1234!` | superAdmin |

### עסקים בפרודקשן
| Email | Business ID | שם |
|-------|-------------|-----|
| `alldogneed@gmail.com` | `6c51668f-00e9-46b1-9ba2-ff113831a172` | **עסק ראשי** |
| `or.rabinovich@gmail.com` | `4c0cd6b3-c7a5-4c29-b8f4-1213ede4b893` | אור רבינוביץ׳ |

---

## 6. מבנה קבצים קריטיים

```
prisma/
├── schema.prisma               # הסכמה הראשית (~1227 שורות, 50+ מודלים)
├── schema.production.prisma    # ⚠️ חייב להיות זהה ל-schema.prisma תמיד (Vercel משתמש בזה)
├── seed.ts                     # נתוני דמו
└── seed-admin.ts               # משתמשי admin

src/
├── middleware.ts               # מגן על כל הרוטים — בודק petra_session
├── lib/
│   ├── auth.ts                 # createSession, ensureUserHasBusiness
│   ├── auth-guards.ts          # requireBusinessAuth, isGuardError
│   ├── prisma.ts               # Prisma singleton (named + default export)
│   ├── utils.ts                # cn, DEMO_BUSINESS_ID, formatCurrency, toWhatsAppPhone
│   ├── constants.ts            # TIERS, LEAD_STAGES, SERVICE_TYPES
│   ├── whatsapp.ts             # sendWhatsAppMessage — Twilio / stub mode
│   ├── slots.ts                # מנוע זמינות הזמנות אונליין
│   └── activity-log.ts         # logCurrentUserActivity
├── app/
│   ├── layout.tsx              # Root: <html lang="he" dir="rtl"> + QueryProvider + AuthProvider
│   ├── login/page.tsx
│   ├── register/page.tsx       # הרשמה: email + Google, ToS, redirect ל-onboarding
│   ├── onboarding/page.tsx     # 5 שלבים (מחוץ ל-dashboard group — ללא AppShell)
│   ├── book/[slug]/page.tsx    # הזמנה אונליין (public)
│   ├── intake/[token]/page.tsx # טופס קליטה (public)
│   └── (dashboard)/
│       ├── layout.tsx          # AppShell + ToS check + onboarding redirect
│       └── [כל הדפים המוגנים]
├── components/
│   ├── layout/app-shell.tsx    # Sidebar + Topbar
│   ├── layout/sidebar.tsx      # accordion, RTL, group navigation
│   ├── finance/FinanceTabs.tsx # tabs: /pricing, /orders, /payment-request, /payments
│   ├── boarding/BoardingTabs.tsx
│   └── service-dogs/ServiceDogsTabs.tsx
└── providers/
    ├── query-provider.tsx      # staleTime: 30s, refetchOnWindowFocus: false
    └── auth-provider.tsx       # useAuth() hook
```

---

## 7. זרימת הרשמה

```
Email:
  /register → POST /api/auth/register
    → PlatformUser + Business(tier:"basic") + BusinessUser + OnboardingProgress + session
    → redirect /onboarding
    → skip/complete → PATCH /api/onboarding/progress (upsert)
    → window.location.href = "/dashboard"

Google OAuth:
  /api/auth/google → callback → ensureUserHasBusiness
    → אין ToS → /tos-accept → /dashboard
    → layout מגלה OnboardingProgress=null → redirect /onboarding  ✅ תקין
    → skip → PATCH upserts → /dashboard

(dashboard)/layout.tsx:
  בודק ToS consent + onboardingProgress.completedAt
  אם חסר → redirect ל-/tos-accept או /onboarding
```

---

## 8. כל הפיצ׳רים — מה בנוי

### 🏠 Dashboard (`/dashboard`)
- 4 כרטיסי סטטיסטיקה: לקוחות, פגישות היום, הכנסה חודשית, משימות פתוחות
- רשימת פגישות קרובות (8 הבאות)
- רשימת משימות אחרונות (5 לא הושלמו)
- SetupChecklist + OnboardingWizardModal + TeamWelcomeModal

### 👥 לקוחות (`/customers`)
- טבלה עם חיפוש, ייצוא CSV (UTF-8 BOM)
- מודל "לקוח חדש": שם*, טלפון*, אימייל, תגיות, הערות
- פרופיל לקוח (`/customers/[id]`):
  - פרטי קשר, תגיות, הערות
  - חיות מחמד (grid) + מודל הוספה
  - היסטוריית פגישות (10 אחרונות)
  - ציר זמן (TimelineEvents)
  - כפתור "בקשת תשלום" → `/payment-request?customerId=...`
  - עריכת כלב: בריאות, התנהגות, תרופות, הערות, פרטים בסיסיים

### 📅 יומן (`/calendar`)
- תצוגה שבועית (א׳-ש׳, 08:00–20:00, 64px לשעה)
- ניווט שבועות, קפיצה להיום
- לחיצה על תא → מודל פגישה חדשה
- לחיצה על פגישה → popup עם פרטים + complete/cancel
- ביטול: inline confirm (confirmCancelId state)

### ✅ משימות (`/tasks`)
- פילטר סטטוס: פתוחות / הושלמו / בוטלו / הכל
- פילטר קטגוריה: כללי / פנסיון / אילוף / לידים / בריאות / תרופות / האכלה
- עדיפויות עם dots צבעוניים
- recurrence rules

### 🎯 לידים (`/leads`)
- Kanban board — עמודות לפי שלבים מה-DB (UUID, לא hardcode)
- העברת שלב: colored dots on hover
- מודל ליד חדש: שם*, טלפון, אימייל, מקור, הערות

### 💬 הודעות (`/messages`)
- grid תבניות עם edit/delete on hover
- פילטר ערוץ: הכל / whatsapp / SMS / email
- עורך: שם*, ערוץ, נושא (email בלבד), גוף + הכנסת משתנים
- משתנים זמינים: `{customerName}`, `{petName}`, `{date}`, `{time}`, `{serviceName}`, `{businessPhone}`

### 🏨 פנסיון (`/boarding`)
- BoardingTabs: פנסיון / האכלה / תרופות / חיסונים / טפסי קליטה
- grid חדרים עם תפוסה (שם, תפוס/קיבולת)
- רשימת לינות: חיית המחמד, לקוח, חדר, תאריכים
- כפתורי check-in/out, badges סטטוס
- מודל לינה חדשה

### 🐾 אימונים (`/training`)
- 7 טאבים: סקירה / אילוף פרטני / אילוף בפנסיון / קבוצות / סדנאות / כלבי שירות / חבילות
- **TrainingPackage** — type: HOME|BOARDING|GROUP|WORKSHOP, sessions, price
- **TrainingProgram** — trainingType, packageId, workPlan, behaviorBaseline, customerExpectations
- **TrainingProgramSession** — practiceItems, nextSessionGoals, homeworkForCustomer
- SessionLogModal עם שמירת כל השדות הנ״ל
- Auto-complete תוכנית כשכל הסשנים הושלמו

### 💰 פיננסים
- **FinanceTabs**: /pricing / /orders / /payment-request / /payments
- **מחירון** (`/pricing`): שתי טאבים — "שירותים" + "פריטי חיוב" (CRUD מלא)
  - פריט חיוב: שם, קטגוריה, מחיר, יחידה, תיאור, paymentUrl, taxMode
  - DELETE = soft delete (isActive: false) + כפתור שחזור
- **תשלומים** (`/payments`): טבלה, סיכום סטטיסטיקות, מודל חדש
- **הזמנות** (`/orders`): CRUD הזמנות
- **בקשת תשלום** (`/payment-request`): קריאת `?customerId` מ-URL, auto-select

### 📊 Analytics (`/analytics`)
- דשבורד אנליטיקס עם גרפים וסטטיסטיקות

### 🔖 הזמנה אונליין
- `/book/[slug]` — wizard רב-שלבי (public, ללא auth)
  - בחירת שירות → בחירת תאריך/שעה → פרטי לקוח → אישור
  - תמיכה בפנסיון (check-in + check-out)
  - WhatsApp לאחר הזמנה: ללקוח (confirmed/pending) + לעסק (pending)
  - GCal sync (fire-and-forget)
- `/api/admin/bookings` — ניהול הזמנות: approve/decline

### 📋 טופס קליטה
- `/intake/[token]` — טופס קליטה (public)
- `/intake-forms` — ניהול טפסי קליטה (admin)
- שליחה ב-WhatsApp/אימייל

### 🐕 כלבי שירות (`/service-dogs`)
- **ServiceDogsTabs** — 6 תת-עמודים:
  - `/service-dogs` — Overview dashboard
  - `/service-dogs/dogs` — grid כרטיסים + פילטר שלב
  - `/service-dogs/[id]` — פרופיל כלב (טאבים: training, medical, compliance, placements, id-card)
  - `/service-dogs/recipients` — טבלת מקבלי שירות + modal פרטים
  - `/service-dogs/placements` — placements + active placements highlight
  - `/service-dogs/compliance` — compliance events + urgency grouping
  - `/service-dogs/id-cards` — grid תעודות + QR viewer

### ⚙️ הגדרות (`/settings`)
- **פרטי עסק**: שם, טלפון, אימייל, כתובת, לוגו URL (עם preview), עוסק מורשה
- **הזמנה אונליין**: קישור הזמנה עם copy-to-clipboard, טקסט פתיחה, מדיניות ביטול, הוראות מקדמה
- **פנסיון**: שעות צ׳ק-אין/אאוט, חישוב לפי לילות/ימים, מינימום לילות
- **זמינות**: שעות פעילות, buffer בין פגישות, notice period, break slots, Google Calendar FreeBusy
- **ניהול צוות** (owners בלבד): הזמנת חברי צוות, ניהול הרשאות
- **נתונים**: ייצוא XLSX/CSV (לקוחות, חיות, שניהם), ייבוא bulk

### 🤖 Automations (`/automations`)
- AutomationRule CRUD
- Scheduled Messages queue (`/scheduled-messages`)

### 📤 Export / Import
- `GET /api/customers/export` — CSV לקוחות (UTF-8 BOM)
- `GET /api/exports/download?type=customers|pets|both&format=xlsx|csv` — XLSX/CSV מלא
- Import bulk CSV/XLSX

### 🔔 Cron Jobs (Vercel, daily)
- `cron/send-reminders` — תזכורות פגישות
- `cron/birthday-reminders` — ברכות יום הולדת
- `cron/generate-tasks` — יצירת משימות אוטומטיות מ-recurrence
- `cron/vaccination-reminders` — תזכורות חיסונים

### 🔐 אבטחה
- 118 API routes מאובטחים עם `requireBusinessAuth` (IDOR fix)
- Rate limiting: IP-based + phone-based
- 2FA (TOTP)
- Audit log לכל פעולות admin
- Activity log לפעולות עסקיות

### 🌐 Integrations
- **Google Calendar** — sync פגישות (GCal FreeBusy לזמינות)
- **Google OAuth** — כניסה עם גוגל
- **Twilio** — WhatsApp
- **Resend** — אימייל
- **Make.com webhook** — `POST /api/webhooks/lead` (x-api-key auth)

### 🔍 חיפוש גלובלי
- GlobalSearch ב-topbar
- תוצאות: לקוחות + חיות מחמד
- ניווט: לקוח → `/customers/[id]`, חיה → `/customers/[customerId]`

### 👑 Admin Panel
- `/admin` — overview
- `/admin/feed` — activity feed
- `/admin/users` — ניהול משתמשים
- `/admin/stats` — סטטיסטיקות פלטפורמה
- `/admin/bookings` — כל ההזמנות
- `/admin/availability` — זמינות גלובלית
- `/business-admin` — ניהול עסק (team, sessions, overview)
- Layout: `src/components/admin/admin-shell.tsx`

---

## 9. דפוסי קוד — Conventions

### API Route מוגן
```typescript
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireBusinessAuth(request);
  if (isGuardError(auth)) return auth;
  const { businessId } = auth;

  const data = await prisma.something.findMany({ where: { businessId } });
  return NextResponse.json(data);
}
```

### Client Component עם React Query
```typescript
"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const queryClient = useQueryClient();

const { data, isLoading, isError } = useQuery({
  queryKey: ["key"],
  queryFn: () => fetch("/api/...").then(r => r.json()),
});

const mutation = useMutation({
  mutationFn: (data) => fetch("/api/...", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["key"] });
    toast.success("נשמר בהצלחה");
  },
  onError: () => toast.error("שגיאה. נסה שוב."),
});
```

### Section Tabs Pattern
```tsx
// תמיד אלמנט ראשון בתוך ה-div הראשי של הדף
<div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 overflow-x-auto scrollbar-hide">
  {tabs.map(tab => (
    <Link key={tab.href} href={tab.href}
      className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all",
        pathname === tab.href
          ? "bg-white shadow-sm text-petra-text"
          : "text-petra-muted hover:bg-white/60"
      )}
    >
      {tab.label}
    </Link>
  ))}
</div>
```

### Schema — שדות שנופלים עליהם
```
Customer:     name (לא firstName/lastName!), phone, phoneNorm, email, address, tags (JSON string)
Pet:          name, species ("dog"/"cat"/"other"), breed, gender, weight
Task:         status: "OPEN"|"COMPLETED"|"CANCELED"  priority: "LOW"|"MEDIUM"|"HIGH"|"URGENT"
Lead:         stages = UUIDs מה-DB (לא hardcode "new"/"contacted"!)
TimelineEvent: אין שדה title — רק type + description
Appointment:  date (DateTime), startTime/endTime (string "HH:mm")
DogBehavior:  fears הוא Boolean (לא string)
```

---

## 10. Database & Deploy

### Prisma Commands
```bash
PATH="..." npx prisma db push        # apply schema changes (dev + prod)
PATH="..." npx prisma generate       # regenerate client
PATH="..." npx prisma studio         # GUI לגלישה ב-DB
```

### ⚠️ חובה אחרי כל שינוי ב-schema.prisma
```bash
cp prisma/schema.prisma prisma/schema.production.prisma
git add prisma/schema.production.prisma
git commit -m "fix: sync production schema"
git push origin main
```
> Vercel מריץ `prisma generate --schema=prisma/schema.production.prisma`
> אם מיושן → TypeScript errors → build נכשל מיד

### בדיקת Deployment
```bash
gh api repos/alldogneed/petra-app/deployments --jq '.[0]'
vercel inspect <url> --logs
```

---

## 11. Sidebar Navigation (מלא)

| Route | שם עברי | Icon | הערות |
|-------|---------|------|-------|
| /dashboard | דשבורד | LayoutDashboard | |
| /customers | לקוחות | Users | |
| /calendar | יומן | Calendar | |
| /scheduler | שיבוץ | CalendarClock | |
| /tasks | משימות | ListTodo | |
| /training | אימונים | GraduationCap | 7 טאבים פנימיים |
| /leads | לידים | Target | |
| /messages | הודעות | MessageSquare | |
| /boarding | פנסיון | Hotel | BoardingTabs (5 עמודים) |
| /payments | תשלומים | CreditCard | FinanceTabs (4 עמודים) |
| /payment-request | בקשת תשלום | Send | FinanceTabs |
| /pricing | מחירון | Tag | FinanceTabs |
| /analytics | אנליטיקס | BarChart | |
| /settings | הגדרות | Settings | 3+ טאבים |
| /service-dogs | כלבי שירות | Dog | קבוצה עם 5 ילדים |

**Sidebar accordion behavior:** `useEffect` על `pathname` — סוגר את כל הקבוצות האחרות, משאיר רק הפעילה פתוחה (מונע overflow).

---

## 12. Known Issues & TODO

| נושא | חומרה | פתרון |
|------|-------|--------|
| `RESEND_API_KEY` חסר ב-Vercel | 🔴 קריטי | resend.com → API Keys → Create → הגדר ב-Vercel |
| `/intake` ב-PUBLIC_PATHS (נגיש ללא auth) | 🟡 נמוכה | להסיר מ-PUBLIC_PATHS |
| favicon.ico חסר | ⚪ קוסמטי | ליצור או להשתמש ב-logo.svg |
| PostCSS חייב `8.4.47` | 🟠 אל תשנה | 8.5.x שוברת Next.js 14 (ESM-only) |

---

## 13. צורת העבודה של המפתח (Or)

### עקרונות
- **"תעשה את זה אתה"** = לבצע ישירות ללא שאלות
- **אחרי כל שינוי קוד** = commit + `vercel --prod` מיד לפרודקשן
- **TypeScript לפני deploy** = תמיד להריץ `tsc --noEmit` לפני push
- **שפה** = כל UI טקסט בעברית, code ותגובות בקוד באנגלית

### Workflow סטנדרטי
1. קרא את הקוד הרלוונטי לפני שינוי
2. TypeScript check
3. `git commit` עם הודעה תיאורית
4. `git push && vercel --prod`
5. סנכרן `schema.production.prisma` אם השתנה schema

### DB Queries (dev)
```bash
# שימוש ב-Prisma client ישירות (אין psql בסביבה)
PATH="..." node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.business.findMany().then(console.log).finally(() => p.\$disconnect());
"
```

### Vercel CLI
```bash
vercel --prod                                    # deploy
vercel env ls                                    # רשימת env vars
vercel env add VARIABLE_NAME production          # הוספת env var
vercel logs <deployment-url>                     # לוגים
```

---

## 14. Webhook חיצוני (Make.com)

```
POST https://petra-app.com/api/webhooks/lead
Header: x-api-key: <MAKE_WEBHOOK_SECRET>
Target: businessId = 6c51668f-00e9-46b1-9ba2-ff113831a172 (alldogneed)
```

---

## 15. Infrastructure

| שירות | פרטים |
|-------|--------|
| GitHub | `alldogneed/petra-app` |
| Vercel | petra-app (alldogneed-9395s-projects) |
| Domain | petra-app.com |
| Database | Neon.tech — project "petra" |
| Email | Resend (⚠️ צריך להגדיר RESEND_API_KEY) |
| WhatsApp | Twilio sandbox (+14155238886) |
| Automations | Make.com → webhook |
