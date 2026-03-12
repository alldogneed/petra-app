# Petra — Conventions & Patterns

## Code Patterns

### Auth in API routes (ALL protected routes)
```typescript
const authResult = await requireBusinessAuth(request);
if (isGuardError(authResult)) return authResult;
const { businessId } = authResult;
// NEVER hardcode DEMO_BUSINESS_ID in protected routes
```

### React Query
```typescript
const { data, isLoading } = useQuery({
  queryKey: ["customers"],
  queryFn: () => fetch("/api/customers").then(r => r.json()),
});
const mutation = useMutation({
  mutationFn: (data) => fetch("/api/customers", { method: "POST", body: JSON.stringify(data) }).then(r => r.json()),
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["customers"] }); toast.success("..."); },
  onError: () => toast.error("..."),
});
```

### Toasts
```typescript
import { toast } from "sonner";
// <Toaster> is in src/app/(dashboard)/layout.tsx
toast.success("לקוח נוסף בהצלחה");
toast.error("שגיאה בשמירה");
```

### TimelineEvent — NO title field!
```typescript
await prisma.timelineEvent.create({
  data: { type: "CUSTOMER_CREATED", description: "לקוח חדש נוצר", businessId, customerId }
});
// Relation is 'timelineEvents' (not 'timeline')
```

### Lead stages — always UUIDs from DB
```typescript
// Stages are UUID strings from LeadStage table — NOT hardcoded "new"/"contacted"
const stages = await prisma.leadStage.findMany({ where: { businessId } });
```

### Prisma import (both patterns work)
```typescript
import prisma from "@/lib/prisma"
import { prisma } from "@/lib/prisma"
```

### Tab navigation pattern
```tsx
<div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-6 overflow-x-auto scrollbar-hide">
  <Link href="/pricing" className={cn("tab", pathname === "/pricing" ? "active" : "inactive")}>
    שירותים
  </Link>
</div>
```

### Tier-gating a page
```tsx
// Rename default export to XxxPageContent, add TierGate wrapper:
export default function XxxPage() {
  return <TierGate feature="boarding"><XxxPageContent /></TierGate>;
}
```

## CSS
- Tailwind only. RTL via `<html dir="rtl">`.
- Custom aliases in `globals.css`: `.btn-primary`, `.btn-secondary`, `.input`, `.label`, `.card`, `.modal-overlay`, `.modal-backdrop`, `.modal-content`

## File Naming
- Pages: `page.tsx` | API routes: `route.ts`
- Client components: `"use client"` at top
- All UI text in Hebrew

## Performance
- Lazy-load recharts, @dnd-kit, large modal trees: `dynamic(() => import(...), { ssr: false })`
- All list APIs: `cursor` + `take` (default 50, max 100–200 by route), return `{ items, nextCursor, hasMore }`
- Client: `useInfiniteQuery` with `getNextPageParam: (page) => page.nextCursor ?? undefined`
- Always use Next.js `<Image>` (not `<img>`) except data URIs

## How to Run

### Dev server (must use this — Hebrew path breaks npm run dev)
```bash
(export PATH="/Users/or-rabinovich/local/node/bin:$PATH"; cd $'/Users/or-rabinovich/Desktop/\xd7\xa4\xd7\x99\xd7\xaa\xd7\x95\xd7\x97/petra-app'; node node_modules/.bin/next dev) > /tmp/petra-dev.log 2>&1 &
```

### TypeScript check
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node node_modules/.bin/tsc --noEmit
```

### Production build
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma generate --schema=prisma/schema.production.prisma && node node_modules/.bin/next build
```

### Prisma commands
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma generate
PATH="/Users/or-rabinovich/local/node/bin:$PATH" npx prisma db push
```

### Seed (ts-node binary missing — use node -e pattern)
```bash
node -e "require('ts-node').register({compilerOptions:{module:'CommonJS'}}); require('./prisma/seed.ts')"
node -e "require('ts-node').register({compilerOptions:{module:'CommonJS'}}); require('./prisma/seed-admin.ts')"
```

### DB queries
```bash
PATH="/Users/or-rabinovich/local/node/bin:$PATH" node -e "
const { PrismaClient } = require('./node_modules/@prisma/client');
const p = new PrismaClient();
p.business.findMany().then(r => console.log(JSON.stringify(r, null, 2))).finally(() => p.\$disconnect());
"
```

## Test Accounts (after seeding)
| Email | Password | Role |
|-------|----------|------|
| `owner@petra.local` | `Admin1234!` | Business owner |
| `admin@petra.local` | `Admin1234!` | Business admin |
| `superadmin@petra.local` | `Admin1234!` | Platform super admin |

## Known Issues / Edge Cases
- `/intake` dashboard page accessible without auth (middleware prefix match bug — don't add to PUBLIC_PATHS, use exact match)
- `ts-node` binary missing from `node_modules/.bin/` — use `node -e` pattern above
- `DogBehavior.fears` is `Boolean` — NOT a string array
- `Pet.customerId` is `String?` (nullable) — always use `pet.customer?.name ?? ""`
- `utils.ts` functions lost if `npx shadcn init` is run — restore: `DEMO_BUSINESS_ID`, `formatCurrency`, `formatDate`, `formatTime`, `getStatusColor`, `getStatusLabel`, `toWhatsAppPhone`, `getTimelineIcon`
- Sentry removed from `next.config.mjs` (not installed) — needs `npm install @sentry/nextjs` + setup
