# Petra App — Code Conventions & Standards

> Standards reverse-engineered from the live codebase. Follow these exactly when adding or modifying code.

---

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Component Architecture](#2-component-architecture)
3. [State Management](#3-state-management)
4. [API Fetching Patterns](#4-api-fetching-patterns)
5. [API Route Conventions](#5-api-route-conventions)
6. [Authentication & Authorization Pattern](#6-authentication--authorization-pattern)
7. [UI / Styling Strategy](#7-ui--styling-strategy)
8. [Forms & Validation](#8-forms--validation)
9. [Toast Notifications](#9-toast-notifications)
10. [Error Handling](#10-error-handling)
11. [TypeScript Conventions](#11-typescript-conventions)
12. [Key Utility Functions](#12-key-utility-functions)
13. [File Naming & Organization](#13-file-naming--organization)
14. [Environment Variables](#14-environment-variables)
15. [Standard Component Example](#15-standard-component-example)

---

## 1. Project Structure

```
petra-app/
├── prisma/
│   ├── schema.prisma              # Dev schema
│   └── schema.production.prisma  # Vercel build (must stay in sync!)
├── src/
│   ├── app/
│   │   ├── (app)/                 # Authenticated app shell
│   │   │   ├── customers/
│   │   │   ├── appointments/
│   │   │   ├── boarding/
│   │   │   ├── leads/
│   │   │   ├── orders/
│   │   │   ├── service-dogs/      # Service dogs module (10 sub-pages)
│   │   │   ├── messages/
│   │   │   ├── analytics/
│   │   │   └── settings/
│   │   ├── api/                   # API routes (Next.js App Router)
│   │   │   ├── auth/
│   │   │   ├── customers/
│   │   │   ├── appointments/
│   │   │   ├── boarding/
│   │   │   ├── orders/
│   │   │   ├── payments/
│   │   │   ├── leads/
│   │   │   ├── service-dogs/
│   │   │   ├── cardcom/
│   │   │   ├── cron/
│   │   │   └── owner/             # Platform admin routes
│   │   ├── book/[slug]/           # Public booking pages (no auth)
│   │   ├── checkout/              # Subscription checkout
│   │   └── layout.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   └── app-shell.tsx
│   │   ├── ui/                    # Radix-based primitives
│   │   ├── paywall/
│   │   │   └── TierGate.tsx
│   │   ├── messages/
│   │   └── [feature]/             # Feature-specific components
│   ├── hooks/
│   │   ├── usePlan.ts
│   │   ├── usePermissions.ts
│   │   ├── useSubscription.ts
│   │   └── useAuth.ts
│   └── lib/
│       ├── prisma.ts
│       ├── session.ts
│       ├── auth-guards.ts
│       ├── permissions.ts
│       ├── feature-flags.ts
│       ├── service-dogs.ts        # Single source of truth for SD constants
│       ├── whatsapp.ts
│       ├── email.ts
│       ├── validation.ts
│       ├── utils.ts
│       ├── constants.ts
│       ├── env.ts                 # Server-side only
│       └── rate-limit.ts
├── docs/                          # Architecture + feature documentation
└── petra_project_context/         # Generated reference docs
```

---

## 2. Component Architecture

### Server vs. Client Components

- **Default to Server Components** (RSC) — no `"use client"` unless needed
- Add `"use client"` only when you need: `useState`, `useEffect`, browser APIs, event handlers, React Query hooks
- Never import `src/lib/env.ts` from a client component (it throws at runtime)

### Component Classification

| Type | Location | Pattern |
|------|----------|---------|
| Page RSC | `src/app/(app)/[feature]/page.tsx` | No `"use client"`, fetches initial data server-side |
| Feature component | `src/components/[feature]/` | `"use client"` with React Query |
| Modal | inline in page or `[Feature]Modal.tsx` | `"use client"`, controlled by `isOpen` prop |
| UI primitive | `src/components/ui/` | Radix-based, headless |
| Layout | `src/components/layout/` | App shell, sidebar |

### Props Pattern

```typescript
// Prefer explicit props interfaces over inline types
interface CustomerCardProps {
  customer: Customer;
  onEdit: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function CustomerCard({ customer, onEdit, onDelete }: CustomerCardProps) {
  // ...
}
```

---

## 3. State Management

### React Query (server state — primary)

All remote data is managed via **TanStack React Query v5**. No Redux, no Zustand for server data.

```typescript
// READ
const { data: customers, isLoading } = useQuery({
  queryKey: ["customers", businessId, filters],
  queryFn: () => fetch("/api/customers").then(r => r.json()),
});

// WRITE
const mutation = useMutation({
  mutationFn: (data: CreateCustomerInput) =>
    fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    toast.success("לקוח נוסף בהצלחה");
  },
  onError: () => {
    toast.error("שגיאה בשמירה");
  },
});
```

### Local UI State

- `useState` for modal visibility, form values, filter selections
- `useReducer` for complex local state (not common in this codebase)
- No global client state library — pass data down via props or React Query cache

### Auth State

```typescript
// In client components — use the hook, never read cookies directly
const { user, isLoading } = useAuth();
// user.isAdmin: boolean (NOT user.platformRole — server-only)
```

### Plan / Permission State

```typescript
const { can, cannot, tier, isFree, isPro } = usePlan();
const { canSeeFinance, canSeePii, isOwner } = usePermissions();
```

---

## 4. API Fetching Patterns

### Simple Fetch in React Query

```typescript
const { data } = useQuery({
  queryKey: ["appointments", date],
  queryFn: () =>
    fetch(`/api/appointments?date=${date}`).then(r => {
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    }),
});
```

### Mutation with Optimistic Update (rare — prefer invalidation)

```typescript
const mutation = useMutation({
  mutationFn: (id: string) =>
    fetch(`/api/leads/${id}`, { method: "DELETE" }).then(r => r.json()),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["leads"] });
    toast.success("ליד נמחק");
  },
});
```

### Date Filter Convention

| Query Param | Filters By | Used In |
|------------|-----------|---------|
| `from` / `to` | `createdAt` | Orders list, payments list |
| `startFrom` / `startTo` | `startAt` | Calendar view for orders |

### Cache-Control Headers (performance)

Applied on high-frequency endpoints:
```typescript
// In route.ts
return NextResponse.json(data, {
  headers: { "Cache-Control": "private, max-age=30" }, // dashboard/counters
});

// auth/me: max-age=300 (5 min)
```

---

## 5. API Route Conventions

### File Structure

Every route is `src/app/api/[resource]/route.ts` or `src/app/api/[resource]/[id]/route.ts`.

```typescript
// src/app/api/customers/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBusinessAuth, isGuardError } from "@/lib/auth-guards";

export async function GET(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  const customers = await prisma.customer.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(customers);
}

export async function POST(request: NextRequest) {
  const authResult = await requireBusinessAuth(request);
  if (isGuardError(authResult)) return authResult;
  const { businessId } = authResult;

  const body = await request.json();
  // Validate input...

  const customer = await prisma.customer.create({
    data: { ...body, businessId }, // businessId always from session
  });

  return NextResponse.json(customer, { status: 201 });
}
```

### IDOR Rule — Critical

```typescript
// ALWAYS derive businessId from session
const { businessId } = authResult;

// When fetching a resource by ID, ALWAYS scope to businessId
const customer = await prisma.customer.findFirst({
  where: { id: params.id, businessId }, // ← both conditions required
});
if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
```

### Prisma Import (both forms work)

```typescript
import prisma from "@/lib/prisma";        // default import
import { prisma } from "@/lib/prisma";    // named import
```

### Public Routes (no auth)

- `/api/booking/*` — public booking (use slug → businessId lookup, NOT DEMO_BUSINESS_ID)
- `DEMO_BUSINESS_ID` only in: seed scripts, explicit platform admin routes

### Cron Routes

```typescript
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ...
}
```

### Tier Gate in API

```typescript
import { hasFeatureWithOverrides } from "@/lib/feature-flags";

const business = await prisma.business.findUnique({ where: { id: businessId } });
if (!hasFeatureWithOverrides(business.tier, "whatsapp_reminders", business.featureOverrides)) {
  return NextResponse.json({ error: "Upgrade required" }, { status: 403 });
}
```

---

## 6. Authentication & Authorization Pattern

### Every Protected Route

```typescript
const authResult = await requireBusinessAuth(request);
if (isGuardError(authResult)) return authResult; // returns 401/403 response
const { businessId } = authResult;
// Never use DEMO_BUSINESS_ID here
```

### Permission Check (fine-grained)

```typescript
const authResult = await requireTenantPermission(request, "tenant.finance.read");
if (isGuardError(authResult)) return authResult;
```

### Manager Pending Approval Pattern

```typescript
// Manager deletes → 202 Accepted, creates PendingApproval
// Owner deletes → 200 OK, immediate execution
// Staff deletes → 403 Forbidden

const { role } = authResult;
if (role === "user") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
if (role === "manager") {
  // Create PendingApproval and return 202
  await prisma.pendingApproval.create({ data: { ... } });
  return NextResponse.json({ pending: true }, { status: 202 });
}
// role === "owner" — proceed
```

---

## 7. UI / Styling Strategy

### Tailwind CSS (only — no custom CSS files)

- RTL via `<html dir="rtl">` on root layout
- All spacing, colors, typography via Tailwind utility classes
- No inline `style={{}}` except for dynamic values (e.g., chart colors)

### Custom CSS Aliases (in `globals.css`)

```css
/* Use these instead of repeating long Tailwind strings */
.btn-primary      /* Orange primary button */
.btn-secondary    /* Gray/white secondary button */
.input            /* Form input field */
.label            /* Form label */
.card             /* Card container with subtle shadow */
.modal-overlay    /* Full-screen modal backdrop */
.modal-content    /* Modal box (centered, white) */
```

### Color Palette

```
Orange brand:    text-orange-500  bg-orange-500  (primary actions)
Sidebar bg:      #0F172A  (slate-900)
Border:          border-slate-200
Muted text:      text-slate-500
Success:         text-emerald-600  bg-emerald-50
Error/danger:    text-red-600  bg-red-50
Warning:         text-amber-600  bg-amber-50
```

### Responsive Design

- Mobile-first utility order: `base → sm: → md: → lg:`
- Hebrew RTL: use `start-*` / `end-*` instead of `left-*` / `right-*` for logical properties
- Safe area utilities: `.pb-safe`, `.pt-safe` for mobile notch

### Icons

```typescript
import { PlusCircle, Trash2, Edit, ChevronRight } from "lucide-react";
// Lucide React v0.400 — always import named icons
```

### Animations

```css
/* Available animation classes */
animate-fade-in       /* 0.2s opacity */
animate-slide-up      /* 0.25s translateY */
animate-scale-in      /* 0.2s scale */
animate-pulse-soft    /* 2s pulsing glow */
```

### Radix UI Primitives

Used for accessible components — dialogs, dropdowns, tooltips, tabs:
```typescript
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
// Always use Radix for interactive overlay components
```

---

## 8. Forms & Validation

### Client-Side Validation Utilities

```typescript
import { validateIsraeliPhone, validateEmail, sanitizeName, validateName } from "@/lib/validation";

validateIsraeliPhone("050-1234567") // → true
validateEmail("foo@bar.com")        // → true
sanitizeName("  <script>Bob</script>  ") // → "Bob"
validateName(sanitizeName(input))   // → true if 2+ chars
```

### Form Pattern (no react-hook-form — use controlled state)

```typescript
const [form, setForm] = useState({ name: "", phone: "", email: "" });
const [errors, setErrors] = useState<Record<string, string>>({});

function validate() {
  const newErrors: Record<string, string> = {};
  if (!validateName(sanitizeName(form.name))) newErrors.name = "שם לא תקין";
  if (!validateIsraeliPhone(form.phone)) newErrors.phone = "מספר טלפון לא תקין";
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
}

function handleSubmit() {
  if (!validate()) return;
  mutation.mutate(form);
}
```

### Phone Normalization

```typescript
import { toWhatsAppPhone } from "@/lib/utils";
toWhatsAppPhone("050-1234567") // → "972501234567"
```

---

## 9. Toast Notifications

Always use Sonner. Import once, use everywhere:

```typescript
import { toast } from "sonner";

toast.success("לקוח נוסף בהצלחה");
toast.error("שגיאה בשמירה");
toast.warning("חסרים שדות חובה");
toast.info("נשמר בהצלחה");

// With action button
toast.success("תור נקבע", {
  action: {
    label: "שלח תזכורת WhatsApp",
    onClick: () => sendReminder(appointmentId),
  },
});
```

**Never** use `alert()`, `confirm()`, or `console.log` for user-facing messages.

---

## 10. Error Handling

### API Error Responses

```typescript
// Standard error format
return NextResponse.json({ error: "Descriptive message" }, { status: 400 });

// Not found (always scope to businessId first)
return NextResponse.json({ error: "Not found" }, { status: 404 });

// Unauthorized
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// Forbidden (authenticated but wrong permissions)
return NextResponse.json({ error: "Forbidden" }, { status: 403 });

// Tier limit
return NextResponse.json({ error: "Upgrade required", limitReached: true }, { status: 403 });
```

### Client-Side Error Handling

```typescript
const mutation = useMutation({
  mutationFn: async (data) => {
    const res = await fetch("/api/customers", { method: "POST", body: JSON.stringify(data) });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "שגיאה לא ידועה");
    }
    return res.json();
  },
  onError: (error: Error) => {
    toast.error(error.message);
  },
});
```

### Nullable Fields — Required Safe Access

```typescript
// pet.customerId is nullable — ALWAYS optional chain
pet.customer?.name ?? ""
pet.customer?.phone ?? "—"

// payment.appointment may be null
payment.appointment?.service?.name ?? "—"

// TimelineEvent has NO title field — only type + description
{ type: "CUSTOMER_CREATED", description: "...", businessId, customerId }
```

---

## 11. TypeScript Conventions

### Strict Mode

TypeScript v5 with `strict: true`. No `any` unless absolutely unavoidable.

### Interface vs. Type

- `interface` for object shapes / React props
- `type` for unions and mapped types

```typescript
// Props: interface
interface CustomerCardProps {
  customer: Customer;
  onSelect: (id: string) => void;
}

// Union: type alias
type PaymentMethod = "cash" | "credit" | "transfer" | "check";
type TierKey = "free" | "basic" | "pro" | "groomer" | "service_dog";
```

### Discriminated Unions for API results

```typescript
type AuthResult =
  | { businessId: string; role: TenantRole }
  | NextResponse; // guard error

// Usage:
if (isGuardError(authResult)) return authResult;
const { businessId } = authResult; // TypeScript now knows the type
```

### Prisma Types

```typescript
import type { Customer, Pet, Appointment } from "@prisma/client";

// Extend with relations:
type CustomerWithPets = Customer & { pets: Pet[] };
```

### Import Aliases

Use `@/` alias throughout — configured in `tsconfig.json`:
```typescript
import { cn } from "@/lib/utils";
import prisma from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth-guards";
```

---

## 12. Key Utility Functions

```typescript
import { cn, formatCurrency, formatDate, formatTime, toWhatsAppPhone } from "@/lib/utils";

// Merge Tailwind classes safely
cn("text-sm font-medium", isActive && "text-orange-500", className)

// Format currency (ILS)
formatCurrency(1234.5)           // → "₪1,234.50"
formatCurrency(1234.5, false)    // → "1,234.50" (no symbol)

// Format date/time (Hebrew format)
formatDate(new Date())           // → "25.03.2026"
formatTime(new Date())           // → "09:30"

// WhatsApp phone normalization
toWhatsAppPhone("050-1234567")   // → "972501234567"

// Status helpers (for display)
getStatusColor("scheduled")      // → Tailwind color class string
getStatusLabel("scheduled")      // → "מתוכנן"

// Timeline icon
getTimelineIcon("PAYMENT_RECEIVED") // → Lucide icon name
```

---

## 13. File Naming & Organization

| Pattern | Convention |
|---------|-----------|
| React components | `PascalCase.tsx` |
| Lib utilities | `kebab-case.ts` |
| API routes | `route.ts` (fixed Next.js convention) |
| Hooks | `useCamelCase.ts` |
| Constants | Exported from `src/lib/constants.ts` or domain file (e.g. `service-dogs.ts`) |

### Feature Module Organization

All components related to a feature live together:
```
src/app/(app)/customers/
├── page.tsx              # Page entry point (RSC)
├── CustomerTable.tsx     # Feature component
├── AddCustomerModal.tsx  # Modal
└── CustomerFilters.tsx   # Filter bar
```

### Single Source of Truth Rule

- Service dog phases: `SERVICE_DOG_PHASES` in `src/lib/service-dogs.ts`
- Lead stages: **always query `LeadStage` table** — never use `constants.ts` hardcoded values
- Recipient stages: `DEFAULT_STAGES` in `/api/service-recipient-stages/route.ts`
- Placement statuses: `SERVICE_DOG_PLACEMENT_STATUSES` in `service-dogs.ts`
- Medical protocol labels: `MEDICAL_PROTOCOL_MAP[key]?.label ?? storedLabel`

---

## 14. Environment Variables

### Server-Side Only (`src/lib/env.ts`)

```typescript
// NEVER import env.ts from a client component — it throws:
// if (typeof window !== "undefined") throw new Error("Server-side only")

import { env, isDev, isProd } from "@/lib/env";

env.DATABASE_URL          // throws if missing
env.RESEND_API_KEY        // throws if missing
env.CRON_SECRET           // throws if missing
```

### Client-Safe Env

Only `NEXT_PUBLIC_*` variables are available in browser code:
```typescript
process.env.NEXT_PUBLIC_APP_URL  // safe on client
```

### Key Variables

```
DATABASE_URL, DIRECT_URL           Database connections
GOOGLE_CLIENT_ID/SECRET            Google OAuth
GCAL_REDIRECT_URI                  Calendar OAuth callback
GCAL_ENCRYPTION_KEY                32-byte key for GCal token encryption
CRON_SECRET                        Vercel cron job auth (ab3ed3...)
RESEND_API_KEY                     Email delivery
EMAIL_FROM                         "Petra <noreply@petra-app.com>"
META_PHONE_NUMBER_ID               WhatsApp Cloud API phone
META_WHATSAPP_TOKEN                Never-expires system user token
STRIPE_API_KEY                     Stripe (partial implementation)
BLOB_READ_WRITE_TOKEN              Vercel Blob storage
APP_URL / NEXT_PUBLIC_APP_URL      App base URL
```

---

## 15. Standard Component Example

A complete example following all conventions — a "Customer Card" client component with React Query and permission gating:

```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Edit, MessageCircle } from "lucide-react";
import { cn, formatDate, toWhatsAppPhone } from "@/lib/utils";
import { usePlan } from "@/hooks/usePlan";
import { usePermissions } from "@/hooks/usePermissions";
import type { Customer, Pet } from "@prisma/client";

interface CustomerCardProps {
  customer: Customer & { pets: Pet[] };
  onEdit: (id: string) => void;
  className?: string;
}

export function CustomerCard({ customer, onEdit, className }: CustomerCardProps) {
  const queryClient = useQueryClient();
  const { can } = usePlan();
  const { canCriticalDelete } = usePermissions();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "שגיאה במחיקה");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("לקוח נמחק בהצלחה");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function handleDelete() {
    if (!confirm(`למחוק את ${customer.name}?`)) return;
    deleteMutation.mutate(customer.id);
  }

  const whatsappUrl = `https://wa.me/${toWhatsAppPhone(customer.phone)}`;

  return (
    <div className={cn("card p-4 flex items-center justify-between gap-3", className)}>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-slate-900 truncate">{customer.name}</h3>
        <p className="text-sm text-slate-500">{customer.phone}</p>
        {customer.pets.length > 0 && (
          <p className="text-xs text-slate-400 mt-1">
            {customer.pets.map(p => p.name).join(", ")}
          </p>
        )}
        <p className="text-xs text-slate-400">
          נוסף {formatDate(customer.createdAt)}
        </p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* WhatsApp — PRO+ only */}
        {can("whatsapp_reminders") && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            title="שלח WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
          </a>
        )}

        <button
          onClick={() => onEdit(customer.id)}
          className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
          title="עריכה"
        >
          <Edit className="w-4 h-4" />
        </button>

        {/* Delete — permission gated */}
        {canCriticalDelete && (
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title="מחיקה"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
```

### Key Patterns in This Example

1. **`"use client"` at top** — required for hooks and event handlers
2. **React Query mutation** with `onSuccess` invalidation + `toast`
3. **`usePlan()` + `usePermissions()`** for dual-layer gating (UI + business logic)
4. **`cn()`** for conditional class merging
5. **`toWhatsAppPhone()`** for proper WhatsApp URL
6. **Optional chain on nullable fields** (`pet.customer?.name`)
7. **RTL-friendly layout** (no `left-*`/`right-*` flex positioning)
8. **Disabled state** on mutation pending
9. **`type` import** from `@prisma/client`

---

## ESLint Rules (implicit from Next.js config)

- `next/core-web-vitals` preset active
- No `<img>` tags — use `<Image>` from `next/image`
- No `<a>` for internal links — use `<Link>` from `next/link` with `prefetch={false}` in sidebar
- No unused variables (`@typescript-eslint/no-unused-vars`)
- Prisma client import must be the singleton from `@/lib/prisma`

## PostCSS Lock

```json
// package.json — NEVER update postcss past 8.4.47
"postcss": "8.4.47"
// 8.5.x breaks Next.js 14.2.x builds
```

---

> **Generated from** source analysis — 2026-03-25.
