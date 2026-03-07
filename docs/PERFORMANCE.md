# Performance Best Practices — Petra App

## 1. Lazy Loading (next/dynamic)

All heavy modals and chart libraries are loaded lazily to reduce initial JS bundle.

### Dashboard lazy-loaded components
```typescript
import dynamic from "next/dynamic";

const SetupChecklist = dynamic(
  () => import("@/components/onboarding/SetupChecklist").then((m) => ({ default: m.SetupChecklist })),
  { ssr: false }
);
const TeamWelcomeModal = dynamic(
  () => import("@/components/onboarding/TeamWelcomeModal").then((m) => ({ default: m.TeamWelcomeModal })),
  { ssr: false }
);
const OnboardingWizardModal = dynamic(
  () => import("@/components/onboarding/OnboardingWizardModal"),
  { ssr: false }
);
const CreateOrderModal = dynamic(
  () => import("@/components/orders/CreateOrderModal").then((m) => ({ default: m.CreateOrderModal })),
  { ssr: false }
);
const RevenueChart = dynamic(
  () => import("@/components/dashboard/RevenueChart"),
  {
    ssr: false,
    loading: () => <div className="card p-5 h-[280px] animate-pulse bg-slate-100 rounded-2xl" />,
  }
);
```

**RevenueChart** is extracted to `src/components/dashboard/RevenueChart.tsx` — this defers loading `recharts` (~130KB) until the chart is visible.

### Rule
- Any component that imports `recharts`, `@dnd-kit`, or large `@radix-ui` blocks should use `dynamic()` with `ssr: false`.
- Always provide a skeleton `loading:` prop for chart components so the layout doesn't shift.

---

## 2. Cursor-Based Pagination

### API response shape
```typescript
{
  customers: Customer[];   // up to `take` items
  nextCursor: string | null;
  hasMore: boolean;
}
```

### API parameters
- `cursor` — last item ID from previous page
- `take` — page size (clamped 1–100, default 50)

### Prisma query pattern
```typescript
const rawTake = parseInt(searchParams.get("take") ?? "50", 10);
const take = Math.min(Math.max(rawTake, 1), 100);
const cursor = searchParams.get("cursor") || undefined;

const items = await prisma.customer.findMany({
  where: { businessId },
  take: take + 1,          // fetch one extra to detect hasMore
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  orderBy: { createdAt: "desc" },
});

const hasMore = items.length > take;
const page = hasMore ? items.slice(0, take) : items;
const nextCursor = hasMore ? page[page.length - 1]?.id : null;
```

### Client pattern (useInfiniteQuery)
```typescript
const { data: pages, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
  queryKey: ["customers", search],
  queryFn: ({ pageParam }) => {
    const params = new URLSearchParams({ take: "50" });
    if (pageParam) params.set("cursor", pageParam as string);
    return fetch(`/api/customers?${params}`).then((r) => r.json());
  },
  initialPageParam: null,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
});

const allItems = useMemo(
  () => pages?.pages.flatMap((p) => p.customers) ?? [],
  [pages]
);
```

### Applied limits (all other routes)
| Route | Limit |
|-------|-------|
| payments, leads, pets, tasks, appointments | 200 |
| training-packages, task-recurrence, booking/availability | 100 |
| booking/blocks | 200 |

---

## 3. Caching (React Query)

Configured in `src/providers/query-provider.tsx`:
```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 minutes
      gcTime: 10 * 60 * 1000,     // 10 minutes
      refetchOnWindowFocus: false,
    },
  },
});
```

No additional server-side caching is needed — all data is tenant-scoped and changes frequently.

---

## 4. Image Optimization

All `<img>` tags replaced with Next.js `<Image>` for automatic WebP conversion, lazy loading, and proper sizing.

### next.config.mjs
```javascript
images: {
  remotePatterns: [{ protocol: "https", hostname: "**" }],
  dangerouslyAllowSVG: true,
  contentDispositionType: "attachment",
  contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
},
```

### Files converted
- `src/components/layout/sidebar.tsx` — logo
- `src/app/login/page.tsx` — logo
- `src/components/onboarding/WelcomeScreen.tsx` — logo
- `src/components/onboarding/WhatNextScreen.tsx` — logo
- `src/app/book/[slug]/page.tsx` — business logo + fallback
- `src/components/owner/owner-shell.tsx` — logo
- `src/components/tenant-admin/tenant-admin-shell.tsx` — logo

### Exceptions (keep `<img>`)
- QR code data URLs (`data:image/...`) — Next.js `<Image>` cannot handle data URIs
- Images with `onError` handlers (logo preview in settings) — simpler with `<img>`

---

## 5. Database Indexes

The Prisma schema already has 82 `@@index` directives. Critical composite indexes verified:
- `Customer`: `[businessId, name]`, `[businessId, createdAt]`
- `Appointment`: `[businessId, date]`, `[businessId, status]`
- `Payment`: `[businessId, createdAt]`, `[businessId, status]`
- `Lead`: `[businessId, stage]`
- `Task`: `[businessId, status]`, `[businessId, dueDate]`

No additional indexes needed at this time.

---

## 6. Bundle Size

Key findings from `next build` analysis:

| Page | First Load JS |
|------|--------------|
| /dashboard | ~120 kB (recharts now lazy) |
| /training | 145 kB (large but justified — many tabs) |
| /settings | 146 kB |
| /tasks | 146 kB |
| /leads | 284 kB ⚠️ (dnd-kit + kanban — acceptable) |

Shared first-load JS: **87.8 kB** (target: <100 kB ✅)

### Libraries to watch
- `recharts` (~130 kB) — lazy loaded via RevenueChart dynamic import
- `@dnd-kit` (~90 kB) — used only in /leads (kanban), acceptable
- `date-fns` (~35 kB) — used across many pages, keep as-is

---

## 7. Loading States

All data-fetching pages use one of:
1. `isLoading && <LoadingSkeleton />` — skeleton component
2. `isLoading && <div className="animate-pulse ...">` — inline pulse placeholder
3. React Query's `isFetchingNextPage` for load-more buttons

Charts use the dynamic `loading:` prop for skeleton placeholders.
