# Petra Service Layer

## Architecture

```
PostgreSQL (Supabase)
        ↑
  src/services/          ← business logic (no HTTP)
        ↑
   ┌────┴────┐
   │         │
API routes   MCP tools (Phase 1)
```

All service functions share the same signature convention:
```typescript
functionName(businessId: string, db: DbClient, ...args): Promise<T>
```

- `businessId` always from session — never from request body (IDOR prevention)
- `db` is the Prisma client injected by the caller (API route or test)
- Throw `ServiceError(message, code)` on failure — never return HTTP responses

## ServiceError Codes

| Code | HTTP equivalent | When to use |
|------|----------------|-------------|
| `NOT_FOUND` | 404 | Resource doesn't exist or belongs to different business |
| `UNAUTHORIZED` | 403 | Session lacks permission for this action |
| `VALIDATION` | 400 | Bad input (missing required field, out-of-range, etc.) |
| `CONFLICT` | 409 | Duplicate / state conflict |
| `EXTERNAL` | 502 | Third-party API failure |

## Service Files

| File | Domain | Key functions |
|------|--------|---------------|
| `appointments.ts` | Appointments, reminders | `listAppointments`, `getAppointment`, `createAppointment`, `updateAppointment`, `deleteAppointment` |
| `boarding.ts` | Boarding stays, yards, rooms | `listBoardingStays`, `getBoardingStay`, `createBoardingStay`, `updateBoardingStay` |
| `business.ts` | Settings, dashboard, analytics, team | `getBusinessSettings`, `updateBusinessSettings`, `getDashboardMetrics`, `getAnalytics`, `listTeamMembers` |
| `clients.ts` | Customers, pets (customer-facing) | `listCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`, `deleteCustomer` |
| `notifications.ts` | Message templates, system messages, scheduled messages | `listMessageTemplates`, `createMessageTemplate`, `getBusinessNotifications`, `cancelScheduledMessage` |
| `orders.ts` | Orders, order lines, payments | `listOrders`, `getOrder`, `createOrder`, `updateOrder`, `deleteOrder` |
| `pets.ts` | Pet profiles, health, medications | `listPets`, `getPet`, `createPet`, `updatePet`, `deletePet` |
| `service-dogs.ts` | Service dog profiles, placements, recipients | `listServiceDogs`, `createServiceDog`, `updateServiceDogPhase`, `listPlacements`, `createPlacement`, `listRecipients` |
| `training.ts` | Training programs, groups, sessions | `listTrainingPrograms`, `getTrainingProgram`, `createTrainingProgram`, `listTrainingGroups` |

## What Stays in Routes (NOT extracted)

- **Rate limiting** — `rateLimit()` calls
- **WhatsApp / GCal side effects** — fire-and-forget after service call
- **Role-based approval flows** — `createPendingApproval`, `x-confirm-action` header checks
- **Session resolution** — who called this, their role, `canSeeSensitive` flag
- **File uploads / signed URLs** — Vercel Blob operations
- **Export generation** — XLSX / PDF construction

## Importing in Routes

```typescript
import { listServiceDogs, createServiceDog, ServiceError } from "@/services/service-dogs";
import prisma from "@/lib/prisma";

// In handler:
try {
  const result = await listServiceDogs(authResult.businessId, prisma, opts);
  return NextResponse.json(result);
} catch (e) {
  if (e instanceof ServiceError && e.code === "NOT_FOUND") {
    return NextResponse.json({ error: e.message }, { status: 404 });
  }
  throw e;
}
```

## Supabase / PgBouncer Constraint

Transaction pooling is incompatible with Prisma interactive transactions.
All multi-step operations use **sequential `await` calls**, never `$transaction`.

## Phase Roadmap

- **Phase 0** ✅ — Service layer (all 9 domain files, ~50 routes thinned)
- **Phase 1** — MCP server with OAuth 2.1, audit log, 3 read-only tools
- **Phase 2** — Write tools + Hebrew UI onboarding
- **Phase 3** — Beta launch
