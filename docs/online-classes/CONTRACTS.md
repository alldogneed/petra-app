# Online Classes — חוזה ממשקים (לבנייה מקבילית)

כל סוכן בונה מול המסמך הזה. אין לסטות משמות/חתימות. סטטוסים lowercase strings.

## Feature flag
`online_classes: FeatureKey` ב-`src/lib/feature-flags.ts` — true ל-`pro` + `service_dog` בלבד (כמו lead_notifications), false לכל השאר.

## Middleware (src/middleware.ts)
מוסיפים ל-`PUBLIC_PREFIX_PATHS`: `"/c/"`, `"/api/portal/"`. Auth נעשה בתוך routes.

## src/lib/portal-auth.ts
```ts
export const PORTAL_SESSION_COOKIE = "petra_portal_session";
export const PORTAL_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

export async function requestPortalOtp(email: string): Promise<void>;
// 6-digit code, SHA-256 hash in PortalOtp, expiry 10min, invalidates prior codes for email,
// sends via sendEmail() from @/lib/email (Hebrew RTL html). Silent success if email invalid-looking? no — caller validates.

export type OtpVerifyResult =
  | { ok: true; portalUser: { id: string; name: string; email: string; phone: string } }
  | { ok: true; needsProfile: true }   // code valid but no PortalUser with this email
  | { ok: false; error: "invalid" | "expired" | "too_many_attempts" };
export async function verifyPortalOtp(email: string, code: string, opts?: { consume?: boolean }): Promise<OtpVerifyResult>;
// attempts++ on wrong code, max 5. Atomic consume via updateMany(consumedAt: null).
// consume=false (default true) — used by verify route when needsProfile (code consumed only on final success).

export async function createPortalUser(data: { email: string; phone: string; name: string }): Promise<PortalUser>;
// validates phone with validateIsraeliPhone from @/lib/validation, normalizes via toWhatsAppPhone-style E.164? store as given 05X → normalize to "+972..." format.

export async function createPortalSession(portalUserId: string): Promise<string>; // returns RAW token (64 hex)
export function setPortalSessionCookie(token: string): void;  // httpOnly, secure prod, sameSite lax, path "/", maxAge 30d
export function clearPortalSessionCookie(): void;
export async function deletePortalSession(rawToken: string): Promise<void>;

export type PortalAuthResult = { portalUser: { id; name; email; phone }; sessionId: string };
export async function resolvePortalSession(request: NextRequest): Promise<PortalAuthResult | null>;
// cookie → sha256 → PortalSession lookup, expiry check, lastSeenAt refresh (throttled fine to skip)

export type PortalCtx = PortalAuthResult & {
  business: { id: string; name: string; slug: string; logo: string | null };
  membership: { id: string; status: string; validUntil: Date | null } | null;
};
export async function requirePortalAuth(request: NextRequest, slug: string): Promise<PortalCtx | NextResponse>;
// 401 {error:"נדרשת התחברות"} if no session; 404 if slug unknown or business.status!=="active"
// or business tier lacks online_classes (hasFeatureWithOverrides); membership may be null.
export function isPortalGuardError(r: PortalCtx | NextResponse): r is NextResponse;

export function isActiveMembership(m: { status: string; validUntil: Date | null } | null): boolean;
// status==="active" && (validUntil===null || validUntil >= now)
```

## src/services/online-classes.ts (צד ניהול — כל פונקציה מקבלת businessId ראשון)
```ts
// branding
getBranding(businessId): Promise<BrandingSettings>            // upsert-on-read with defaults
updateBranding(businessId, data: Partial<{logoUrl,primaryColor,secondaryColor,senderName,paymentLinkUrl,aboutText}>): Promise<BrandingSettings>
// live classes
listClasses(businessId, opts?: { from?: Date; includePast?: boolean }): Promise<OnlineClassWithCounts[]> // registrations count incl waitlist count
createClass(businessId, data: {title,description?,instructorName?,startsAt: Date,durationMin?,capacity,zoomLink?}): Promise<OnlineClass>
updateClass(businessId, classId, data: Partial<same>): Promise<OnlineClass>  // capacity shrink below spotsTaken → ServiceError VALIDATION
deleteClass(businessId, classId): Promise<void>               // only if startsAt future; cascades registrations
listRegistrations(businessId, classId): Promise<Array<{id,status,createdAt,portalUser:{name,phone,email}}>>
// memberships
listMemberships(businessId, opts?: { status?: string }): Promise<Array<Membership & {portalUser:{name,phone,email}}>>
approveMembership(businessId, membershipId, data?: { validUntil?: Date|null; paymentNote?: string }): Promise<Membership>
// sets status active, approvedAt now; fire-and-forget notify (WhatsApp free-form via sendWhatsAppMessage + email) with portal link
updateMembership(businessId, membershipId, data: Partial<{status,validUntil,paymentNote}>): Promise<Membership>
createManualMembership(businessId, data: {name,phone,email,validUntil?,paymentNote?}): Promise<Membership>
// find-or-create PortalUser by email (or phone), create/activate membership immediately (status active, approvedAt now)
// courses
listCourses(businessId): Promise<Array<Course & {_count marker: modules, lessons total}>>
createCourse(businessId, data: {title,description?,coverUrl?}): Promise<Course>
updateCourse(businessId, courseId, data: Partial<{title,description,coverUrl,status}>): Promise<Course> // status "draft"|"published"
deleteCourse(businessId, courseId): Promise<void>
getCourseTree(businessId, courseId): Promise<Course & {modules: (CourseModule & {lessons: Lesson[]})[]}> // ordered by position
createModule(businessId, courseId, data: {title}): Promise<CourseModule>          // position = max+10
updateModule(businessId, moduleId, data: {title?}): Promise<CourseModule>
deleteModule(businessId, moduleId): Promise<void>
createLesson(businessId, moduleId, data: {title,type?,videoRef?,fileUrl?,textContent?,durationMin?,isFreePreview?}): Promise<Lesson>
updateLesson(businessId, lessonId, data: Partial<same+position? no>): Promise<Lesson>
deleteLesson(businessId, lessonId): Promise<void>
reorderModules(businessId, courseId, orderedIds: string[]): Promise<void>          // rewrite positions 10,20,30...
reorderLessons(businessId, moduleId, orderedIds: string[]): Promise<void>
```
כל שאילתה על ישויות בנות (module/lesson) מאמתת שרשרת בעלות עד businessId. שגיאות: `ServiceError` מ-`@/services/errors` (או המיקום הקיים בריפו — לבדוק import קיים ב-services אחרים).

## src/services/portal.ts (צד בעל הכלב — מקבל businessId + membership context)
```ts
getPublicBranding(slug: string): Promise<{business:{id,name,slug,logo}, branding: {...}} | null> // null if not found/inactive/no tier
requestMembership(businessId, portalUserId): Promise<Membership>  // upsert: exists→return as-is (idempotent), else create pending; fire-and-forget notify business owner (email + in-app? email enough)
listPortalClasses(businessId, membershipId | null): Promise<Array<{id,title,description,instructorName,startsAt,durationMin,capacity,spotsTaken,myStatus: "registered"|"waitlist"|null,zoomLink: string|null}>>
// zoomLink returned ONLY if myStatus==="registered" AND startsAt within next 2h (or past-start within duration)
registerForClass(businessId, membershipId, classId): Promise<{status:"registered"|"waitlist"}>
// ATOMIC (no interactive tx): $executeRaw UPDATE spotsTaken+1 WHERE id AND businessId AND spotsTaken<capacity
// claimed=1 → upsert registration "registered"; claimed=0 → upsert "waitlist".
// re-register after cancel: update existing row. Guard: class in future, membership active.
cancelRegistration(businessId, membershipId, classId): Promise<void>
// if was "registered": set cancelled, $executeRaw spotsTaken-1 (floor 0), then promote oldest waitlist:
// pick oldest waitlist row → $executeRaw claim spot → if claimed, update row to "registered" + fire-and-forget WhatsApp to promoted user
listPortalCourses(businessId, membershipActive: boolean): Promise<Array<{id,title,description,coverUrl,lessonCount,hasFreePreview}>> // published only
getPortalCourse(businessId, courseId, membershipId | null, membershipActive: boolean): Promise<CourseTree | null>
// draft → null. Not active membership: lessons return WITHOUT videoRef/fileUrl/textContent unless isFreePreview
markLessonComplete(businessId, membershipId, lessonId): Promise<void> // upsert LessonProgress; verify lesson→module→course.businessId chain + published
```

## API — פורטל (auth עצמי, rate-limited)
```
POST /api/portal/auth/request-otp   {email}                    → {ok:true} always (anti-enumeration), RL 3/15min per email+ip
POST /api/portal/auth/verify        {email, code, name?, phone?} → {user} + cookie | {needsProfile:true} | 400/401/429
POST /api/portal/auth/logout                                    → {ok:true}, clears cookie+session
GET  /api/portal/[slug]/branding                                → public: {business:{name,logo}, branding:{primaryColor,secondaryColor,logoUrl,aboutText,paymentLinkUrl,senderName}}  (RL PUBLIC_READ)
GET  /api/portal/[slug]/me                                      → {portalUser, membership: {...}|null}
POST /api/portal/[slug]/membership/request                      → {membership}
GET  /api/portal/[slug]/classes                                 → {classes: [...]}   (requires session; membership not required to VIEW)
POST /api/portal/[slug]/classes/[id]/register                   → {status} (requires ACTIVE membership; RL API_WRITE)
POST /api/portal/[slug]/classes/[id]/cancel                     → {ok:true}
GET  /api/portal/[slug]/courses                                 → {courses:[...]}
GET  /api/portal/[slug]/courses/[courseId]                      → {course tree, myProgress: lessonId[]}
POST /api/portal/[slug]/lessons/[lessonId]/complete             → {ok:true}
```
כל route: `export const dynamic = 'force-dynamic'`.

## API — ניהול (requireBusinessAuth + isGuardError, businessId מה-session בלבד)
```
GET/PATCH  /api/online-classes/branding
GET/POST   /api/online-classes/classes            POST body: {title,startsAt,capacity,...}
PATCH/DELETE /api/online-classes/classes/[id]
GET        /api/online-classes/classes/[id]/registrations
GET/POST   /api/online-classes/memberships        POST = manual add {name,phone,email,validUntil?,paymentNote?}
PATCH      /api/online-classes/memberships/[id]   {action:"approve"} | {status}/{validUntil}/{paymentNote}
GET/POST   /api/online-classes/courses
GET/PATCH/DELETE /api/online-classes/courses/[id] (GET = full tree)
POST       /api/online-classes/courses/[id]/modules
PATCH/DELETE /api/online-classes/modules/[id]
POST       /api/online-classes/modules/[id]/lessons
PATCH/DELETE /api/online-classes/lessons/[id]
POST       /api/online-classes/courses/[id]/reorder   {moduleIds: string[]} | {moduleId, lessonIds: string[]}
```
Tier gate בשרת: כל route ניהול בודק `hasFeatureWithOverrides(tier, "online_classes", overrides)` → 403.

## Cron
`GET/POST /api/cron/online-class-reminders` — `verifyCronAuth` ראשון. שני jobs:
1. **Zoom link**: classes where `startsAt` in (now, now+75min], `zoomLink != null`, `zoomLinkSentAt == null` → atomic claim per class: `updateMany({where:{id, zoomLinkSentAt: null}, data:{zoomLinkSentAt: now}})`, count===1 → שלח WhatsApp לכל registered (body עברית עם קישור) + email fallback.
2. **Membership expiry**: active memberships, `validUntil` in (now, now+3d], `expiryReminderSentAt == null` → אותו דפוס claim → WhatsApp+email עם paymentLinkUrl של העסק.
מוסיפים ל-`.github/workflows/cron.yml` צעד curl כל 15 דק' (לפי הדפוס הקיים של send-reminders).

## UI ניהול — src/app/(dashboard)/online-classes/page.tsx
"use client", `<PageTitle title="שיעורים אונליין" />` + `<TierGate feature="online_classes" title="שיעורים אונליין" description="...">`.
טאבים (דפוס training): שיעורים חיים | קורסים | מנויים | מיתוג. React Query + sonner. עברית מלאה RTL, כפתור "צפה בפורטל" (קישור `/c/{slug}`, ומצב ריק אם אין slug לעסק — הפניה להגדרות). Sidebar: הוספה לקבוצת **מודולים**: `{ name: "שיעורים אונליין", href: "/online-classes", icon: MonitorPlay, lockedFeature: "online_classes", isNew: true }`.

## UI פורטל — src/app/c/[slug]/
- `layout.tsx` (server): טוען branding דרך getPublicBranding (cache()), notFound() אם null. מזריק `<style>` עם `--portal-primary`, `--portal-primary-dark`. Metadata: `${business.name} — פורטל חברים`. פוטר "Powered by Petra" (קישור petra-app.com). RTL, Heebo (יורש מה-root).
- `page.tsx`: דף בית — לוגו+שם+aboutText, מצב מנוי (אין/ממתין/פעיל/פג), CTA הצטרפות, רשימת שיעורים קרובים + קורסים.
- `login/page.tsx`: שלב אימייל → שלב קוד (6 ספרות, autoFocus) → שלב פרופיל (שם+טלפון) אם needsProfile.
- `classes/page.tsx`: כרטיסי שיעורים — תאריך עברי, קיבולת (X/Y), כפתור הרשמה/המתנה/ביטול, zoomLink כשזמין.
- `courses/page.tsx` + `courses/[courseId]/page.tsx`: קטלוג + נגן — sidebar פרקים/שיעורים, iframe `youtube-nocookie.com/embed/{videoRef}`, checkbox "סיימתי", progress bar, שיעורי preview פתוחים גם בלי מנוי + באנר הצטרפות.
- עיצוב: mobile-first `max-w-lg`/`max-w-3xl`, כרטיסים `rounded-2xl shadow-card`, צבע primary מהמיתוג (inline style / CSS var), fallback לכתום פטרה. אין sidebar של הדשבורד.

## כללים מחייבים לכל סוכן
- עברית מלאה ב-UI, RTL. אין אנגלית בטקסטים למשתמש.
- אין interactive `prisma.$transaction(async...)` — PgBouncer. `$transaction([...])` batch מותר.
- כל שאילתה מסוננת businessId (ישירות או דרך שרשרת בעלות מאומתת).
- ולידציה עם zod או ידנית בקצוות; strings מקוצצים; email lowercase-trim.
- `export const dynamic = 'force-dynamic'` בכל route.
- אין להתקין חבילות חדשות.
