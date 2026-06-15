# Service Layer Mapping

> Phase 0 of MCP integration. Every extractable route is classified below.
> The service layer lives at `src/services/` — each domain gets one file.
> **All service functions receive `(businessId: string, supabase: PrismaClient, ...args)` — no Request/Response awareness.**

---

## Rules

- **Extract**: Routes with reusable business logic — data fetching, writes, derivations
- **Skip**: Auth, Cardcom billing, webhooks, cron, platform-admin, seed — these stay as pure routes
- **Never touch**: All `cardcom/*` routes (5-layer billing security)

---

## Domain: `clients` → `src/services/clients.ts`

| Route | Methods | Functions to Extract |
|-------|---------|---------------------|
| `customers/route.ts` | GET, POST | `listCustomers(biz, filters)`, `createCustomer(biz, data)` — phone normalization, duplicate detection |
| `customers/[id]/route.ts` | GET, PATCH, DELETE | `getCustomer(biz, id)`, `updateCustomer(biz, id, data)`, `deleteCustomer(biz, id)` — full cascade delete |
| `leads/route.ts` | GET, POST | `listLeads(biz, filters)`, `createLead(biz, data)` — WhatsApp notification fire-and-forget |
| `leads/[id]/route.ts` | GET, PATCH, DELETE | `getLead(biz, id)`, `updateLead(biz, id, data)`, `deleteLead(biz, id)` |
| `leads/[id]/convert/route.ts` | POST | `convertLead(biz, leadId)` — creates customer from lead |
| `tasks/route.ts` | GET, POST | `listTasks(biz, filters)`, `createTask(biz, data)` |
| `tasks/[id]/route.ts` | PATCH, DELETE | `updateTask(biz, id, data)`, `deleteTask(biz, id)` |
| `task-templates/route.ts` | GET, POST | `listTaskTemplates(biz)`, `createTaskTemplate(biz, data)` |
| `task-templates/[id]/route.ts` | PATCH, DELETE | `updateTaskTemplate(biz, id, data)`, `deleteTaskTemplate(biz, id)` |
| `task-recurrence/route.ts` | GET, POST | `listTaskRecurrences(biz)`, `createTaskRecurrence(biz, data)` |
| `task-recurrence/[id]/route.ts` | DELETE | `deleteTaskRecurrence(biz, id)` |
| `search/route.ts` | GET | `searchAll(biz, query)` — cross-entity global search |

---

## Domain: `pets` → `src/services/pets.ts`

| Route | Methods | Functions to Extract |
|-------|---------|---------------------|
| `pets/route.ts` | GET | `listPets(biz, filters)` — vaccination status, medication counts |
| `pets/[petId]/route.ts` | GET, PATCH, DELETE | `getPet(biz, petId)`, `updatePet(biz, petId, data)`, `deletePet(biz, petId)` |
| `pets/[petId]/health/route.ts` | PATCH | `upsertPetHealth(biz, petId, data)` — vaccination history upsert |
| `pets/[petId]/documents/route.ts` | GET, POST, DELETE | `listPetDocuments(biz, petId)`, `addPetDocument(biz, petId, data)`, `deletePetDocument(biz, petId, docId)` |

---

## Domain: `appointments` → `src/services/appointments.ts`

| Route | Methods | Functions to Extract |
|-------|---------|---------------------|
| `appointments/route.ts` | GET, POST | `listAppointments(biz, dateRange, filters)`, `createAppointment(biz, data)` — calendar sync + reminder |
| `appointments/[id]/route.ts` | PATCH, DELETE | `updateAppointment(biz, id, data)`, `deleteAppointment(biz, id)` — reminder reschedule + calendar cleanup |
| `appointments/recurring/route.ts` | POST | `createRecurringAppointments(biz, data)` |
| `appointments/[id]/remind/route.ts` | POST | `sendAppointmentReminder(biz, id)` — manual WhatsApp trigger (PRO+) |
| `availability/settings/route.ts` | GET, PATCH | `getAvailabilitySettings(biz)`, `updateAvailabilitySettings(biz, data)` |
| `availability/breaks/route.ts` | GET, POST | `listAvailabilityBreaks(biz)`, `createAvailabilityBreak(biz, data)` |
| `availability/breaks/[id]/route.ts` | DELETE | `deleteAvailabilityBreak(biz, id)` |
| `availability/import-holidays/route.ts` | POST | `importIsraeliHolidays(biz)` |
| `sessions/route.ts` | GET | `listSessions(biz, filters)` — all session types unified |

---

## Domain: `boarding` → `src/services/boarding.ts`

| Route | Methods | Functions to Extract |
|-------|---------|---------------------|
| `boarding/route.ts` | GET, POST | `listBoardingStays(biz, filters)`, `createBoardingStay(biz, data)` — room capacity check + WhatsApp + calendar |
| `boarding/[id]/route.ts` | GET, PATCH, DELETE | `getBoardingStay(biz, id)`, `updateBoardingStay(biz, id, data)`, `deleteBoardingStay(biz, id)` |
| `boarding/availability/route.ts` | GET | `checkBoardingAvailability(biz, dateRange)` |
| `boarding/rooms/route.ts` | GET, POST | `listBoardingRooms(biz)`, `createBoardingRoom(biz, data)` |
| `boarding/rooms/[id]/route.ts` | PATCH, DELETE | `updateBoardingRoom(biz, id, data)`, `deleteBoardingRoom(biz, id)` |
| `boarding/yards/route.ts` | GET, POST | `listBoardingYards(biz)`, `createBoardingYard(biz, data)` |
| `boarding/yards/[id]/route.ts` | PATCH, DELETE | `updateBoardingYard(biz, id, data)`, `deleteBoardingYard(biz, id)` |
| `boarding/[id]/care-logs/route.ts` | GET, POST | `listCareLogs(biz, stayId)`, `createCareLog(biz, stayId, data)` |
| `boarding/care-log/route.ts` | GET | `listAllCareLogs(biz, filters)` |
| `boarding/care-log/[id]/route.ts` | PATCH, DELETE | `updateCareLog(biz, id, data)`, `deleteCareLog(biz, id)` |
| `boarding/export/route.ts` | GET | `exportBoardingData(biz, filters)` — XLSX |

---

## Domain: `training` → `src/services/training.ts`

| Route | Methods | Functions to Extract |
|-------|---------|---------------------|
| `training-groups/route.ts` | GET, POST | `listTrainingGroups(biz)`, `createTrainingGroup(biz, data)` |
| `training-groups/[id]/route.ts` | GET, PATCH, DELETE | `getTrainingGroup(biz, id)`, `updateTrainingGroup(biz, id, data)`, `deleteTrainingGroup(biz, id)` |
| `training-groups/[id]/sessions/route.ts` | GET, POST | `listGroupSessions(biz, groupId)`, `createGroupSession(biz, groupId, data)` |
| `training-groups/[id]/sessions/generate/route.ts` | POST | `generateGroupSessions(biz, groupId, count, opts)` — bulk recurring + reminders |
| `training-groups/[id]/sessions/[sessionId]/route.ts` | PATCH, DELETE | `updateGroupSession(biz, groupId, sessionId, data)`, `deleteGroupSession(biz, groupId, sessionId)` |
| `training-groups/[id]/participants/route.ts` | GET, POST, DELETE | `listGroupParticipants(biz, groupId)`, `addGroupParticipant(biz, groupId, data)`, `removeGroupParticipant(biz, groupId, participantId)` |
| `training-groups/calendar/route.ts` | GET | `getGroupSessionsForCalendar(biz, dateRange)` |
| `training-attendance/[id]/route.ts` | PATCH | `updateAttendance(biz, attendanceId, data)` |
| `training-programs/route.ts` | GET, POST | `listTrainingPrograms(biz)`, `createTrainingProgram(biz, data)` |
| `training-programs/[id]/route.ts` | GET, PATCH, DELETE | `getTrainingProgram(biz, id)`, `updateTrainingProgram(biz, id, data)`, `deleteTrainingProgram(biz, id)` |
| `training-programs/[id]/sessions/route.ts` | GET, POST | `listProgramSessions(biz, programId)`, `createProgramSession(biz, programId, data)` |
| `training-programs/[id]/sessions/[sessionId]/route.ts` | PATCH, DELETE | `updateProgramSession(biz, programId, sessionId, data)`, `deleteProgramSession(biz, programId, sessionId)` |
| `training-programs/[id]/goals/route.ts` | GET, POST, PATCH | `listProgramGoals(biz, programId)`, `upsertProgramGoal(biz, programId, data)` |
| `training-programs/[id]/homework/route.ts` | GET, POST | `listProgramHomework(biz, programId)`, `createProgramHomework(biz, programId, data)` |
| `training-programs/calendar/route.ts` | GET | `getProgramSessionsForCalendar(biz, dateRange)` |
| `training-packages/route.ts` | GET, POST | `listTrainingPackages(biz)`, `createTrainingPackage(biz, data)` |
| `training-packages/[id]/route.ts` | PATCH, DELETE | `updateTrainingPackage(biz, id, data)`, `deleteTrainingPackage(biz, id)` |

---

## Domain: `orders` → `src/services/orders.ts`

| Route | Methods | Functions to Extract |
|-------|---------|---------------------|
| `orders/route.ts` | GET, POST | `listOrders(biz, filters)`, `createOrder(biz, data)` — pricing, auto-linking |
| `orders/[id]/route.ts` | GET, PATCH, DELETE | `getOrder(biz, id)`, `updateOrder(biz, id, data)`, `deleteOrder(biz, id)` |
| `payments/route.ts` | GET, POST | `listPayments(biz, filters)`, `createPayment(biz, data)` — invoice auto-generation |
| `payments/[id]/route.ts` | PATCH, DELETE | `updatePayment(biz, id, data)`, `deletePayment(biz, id)` |
| `invoicing/documents/route.ts` | GET, POST | `listInvoices(biz, filters)`, `createInvoiceDraft(biz, data)` — VAT calculation |
| `invoicing/documents/[id]/route.ts` | GET, PATCH | `getInvoice(biz, id)`, `updateInvoice(biz, id, data)` |
| `invoicing/documents/[id]/send/route.ts` | POST | `sendInvoice(biz, id)` — email send |
| `invoicing/jobs/route.ts` | GET, POST | `listInvoiceJobs(biz)`, `createInvoiceJob(biz, data)` |
| `invoicing/jobs/[id]/route.ts` | PATCH, DELETE | `updateInvoiceJob(biz, id, data)`, `deleteInvoiceJob(biz, id)` |
| `pricing/route.ts` | GET, PATCH | `getPricingConfig(biz)`, `updatePricingConfig(biz, data)` |

---

## Domain: `business` → `src/services/business.ts`

| Route | Methods | Functions to Extract |
|-------|---------|---------------------|
| `settings/route.ts` | GET, PATCH | `getBusinessSettings(biz)`, `updateBusinessSettings(biz, data)` |
| `settings/logo/route.ts` | POST, DELETE | `uploadBusinessLogo(biz, fileUrl)`, `deleteBusinessLogo(biz)` |
| `services/route.ts` | GET, POST | `listServices(biz)`, `createService(biz, data)` |
| `services/[id]/route.ts` | PATCH, DELETE | `updateService(biz, id, data)`, `deleteService(biz, id)` |
| `team-members/route.ts` | GET | `listTeamMembers(biz)` |
| `business-admin/overview/route.ts` | GET | `getBusinessOverview(biz)` — aggregate metrics |
| `business-admin/activity/route.ts` | GET | `getBusinessActivity(biz, filters)` — timeline events |
| `business-admin/sessions/route.ts` | GET | `getActiveSessions(biz)` |
| `business-admin/team/route.ts` | GET, POST | `listTeam(biz)`, `inviteTeamMember(biz, data)` |
| `business-admin/team/[memberId]/route.ts` | PATCH, DELETE | `updateTeamMember(biz, memberId, data)`, `removeTeamMember(biz, memberId)` |
| `dashboard/route.ts` | GET | `getDashboardMetrics(biz)` — aggregate: revenue, appointments, outstanding orders |
| `analytics/route.ts` | GET | `getAnalytics(biz, period, filters)` — revenue, appointments, leads, pets |
| `analytics/export/route.ts` | GET | `exportAnalytics(biz, period)` — XLSX |
| `onboarding/progress/route.ts` | GET, PATCH | `getOnboardingProgress(biz, userId)`, `updateOnboardingProgress(biz, userId, data)` |
| `boarding/route.ts` | GET | (boarding domain above) |

---

## Domain: `notifications` → `src/services/notifications.ts`

| Route | Methods | Functions to Extract |
|-------|---------|---------------------|
| `messages/route.ts` | GET, POST, DELETE | `listMessageTemplates(biz)`, `createMessageTemplate(biz, data)`, `deleteMessageTemplate(biz, id)` |
| `scheduled-messages/route.ts` | GET | `listScheduledMessages(biz, filters)` |
| `scheduled-messages/[id]/send/route.ts` | POST | `sendScheduledMessageNow(biz, id)` — manual trigger |
| `automations/route.ts` | GET, POST | `listAutomations(biz)`, `createAutomation(biz, data)` |
| `automations/[id]/route.ts` | GET, PATCH, DELETE | `getAutomation(biz, id)`, `updateAutomation(biz, id, data)`, `deleteAutomation(biz, id)` |
| `notifications/route.ts` | GET | `getNotificationSummary(biz)` — aggregate: tasks + payments + appointments + boarding |
| `user-notifications/route.ts` | GET | `listUserNotifications(userId)` |
| `user-notifications/[id]/route.ts` | PATCH | `markNotificationRead(userId, id)` |
| `user-notifications/read-all/route.ts` | POST | `markAllNotificationsRead(userId)` |
| `system-messages/route.ts` | GET, POST | `listSystemMessages()`, `createSystemMessage(data)` |
| `system-messages/[id]/read/route.ts` | POST | `markSystemMessageRead(userId, id)` |
| `system-messages/read-all/route.ts` | POST | `markAllSystemMessagesRead(userId)` |
| `intake/create/route.ts` | POST | `createIntakeForm(biz, data)` — token generation |
| `contracts/templates/route.ts` | GET, POST | `listContractTemplates(biz)`, `createContractTemplate(biz, data)` |
| `contracts/templates/[id]/route.ts` | PATCH, DELETE | `updateContractTemplate(biz, id, data)`, `deleteContractTemplate(biz, id)` |
| `contracts/[id]/route.ts` | GET, PATCH | `getContractRequest(biz, id)`, `updateContractRequest(biz, id, data)` |
| `templates/route.ts` | GET, POST | `listWhatsAppTemplates(biz)`, `saveWhatsAppTemplate(biz, data)` |

---

## Domain: `service-dogs` → `src/services/service-dogs.ts`

| Route | Methods | Functions to Extract |
|-------|---------|---------------------|
| `service-dogs/route.ts` | GET, POST | `listServiceDogs(biz, filters)`, `createServiceDog(biz, data)` |
| `service-dogs/[id]/route.ts` | GET, PATCH, DELETE | `getServiceDog(biz, id)`, `updateServiceDog(biz, id, data)`, `deleteServiceDog(biz, id)` |
| `service-dogs/[id]/phase/route.ts` | PATCH | `updateServiceDogPhase(biz, id, phase)` — validates against SERVICE_DOG_PHASES |
| `service-dogs/[id]/documents/route.ts` | GET, POST, DELETE | `listServiceDogDocuments(biz, id)`, `addServiceDogDocument(biz, id, data)`, `deleteServiceDogDocument(biz, id, docId)` |
| `service-dogs/[id]/upload/route.ts` | POST | `uploadServiceDogFile(biz, id, fileUrl)` |
| `service-dogs/[id]/medical/route.ts` | GET, PATCH | `getServiceDogMedical(biz, id)`, `updateServiceDogMedical(biz, id, data)` |
| `service-dogs/[id]/milestones/route.ts` | GET, POST | `listMilestones(biz, id)`, `createMilestone(biz, id, data)` |
| `service-dogs/[id]/evaluations/route.ts` | GET, POST | `listEvaluations(biz, id)`, `createEvaluation(biz, id, data)` |
| `service-dogs/[id]/evaluations/[evalId]/route.ts` | PATCH, DELETE | `updateEvaluation(biz, id, evalId, data)`, `deleteEvaluation(biz, id, evalId)` |
| `service-dogs/[id]/training/route.ts` | GET, POST | `listServiceDogTrainingLogs(biz, id)`, `createTrainingLog(biz, id, data)` |
| `service-dogs/[id]/training/[logId]/route.ts` | PATCH, DELETE | `updateTrainingLog(biz, id, logId, data)`, `deleteTrainingLog(biz, id, logId)` |
| `service-dogs/[id]/insurance/route.ts` | GET, POST | `listInsurancePolicies(biz, id)`, `createInsurancePolicy(biz, id, data)` |
| `service-dogs/[id]/insurance/[insuranceId]/route.ts` | PATCH, DELETE | `updateInsurancePolicy(biz, id, insuranceId, data)` |
| `service-dogs/[id]/insurance/[insuranceId]/claims/route.ts` | GET, POST | `listInsuranceClaims(biz, id, insuranceId)`, `createInsuranceClaim(biz, id, insuranceId, data)` |
| `service-dogs/[id]/insurance/[insuranceId]/claims/[claimId]/route.ts` | PATCH, DELETE | `updateInsuranceClaim(biz, id, insuranceId, claimId, data)` |
| `service-dogs/[id]/vests/route.ts` | GET, POST | `listVests(biz, id)`, `createVest(biz, id, data)` |
| `service-dogs/[id]/vests/[vestId]/route.ts` | PATCH, DELETE | `updateVest(biz, id, vestId, data)`, `deleteVest(biz, id, vestId)` |
| `service-dogs/[id]/compliance/route.ts` | GET, POST | `getComplianceStatus(biz, id)`, `updateCompliance(biz, id, data)` |
| `service-dogs/[id]/vaccine-plan/route.ts` | GET, PATCH | `getVaccinePlan(biz, id)`, `updateVaccinePlan(biz, id, data)` |
| `service-dogs/[id]/protocols/sync-health/route.ts` | POST | `syncHealthProtocols(biz, id)` |
| `service-dogs/[id]/id-card/route.ts` | GET | `getServiceDogIdCard(biz, id)` |
| `service-dogs/vaccinations/route.ts` | GET | `listAllVaccinations(biz, filters)` |
| `service-dogs/vaccinations/apply-schedule/route.ts` | POST | `applyVaccinationSchedule(biz, data)` |
| `service-dogs/alerts/route.ts` | GET | `getServiceDogAlerts(biz)` — overdue vaccinations, expiring items |
| `service-dogs/standalone-pet/route.ts` | POST | `createStandalonePet(biz, data)` |
| `service-dogs/sync-training/route.ts` | POST | `syncTrainingData(biz)` |
| `service-dogs/export/route.ts` | GET | `exportServiceDogs(biz, filters)` — XLSX |
| `service-dogs/export/government/route.ts` | GET | `exportGovernmentReport(biz)` |
| `service-dogs/export/care/route.ts` | GET | `exportCareReport(biz)` |
| `service-dogs/import/route.ts` | POST | `importServiceDogs(biz, file)` |
| `service-placements/route.ts` | GET, POST | `listPlacements(biz, filters)`, `createPlacement(biz, data)` — status default ACTIVE |
| `service-placements/[id]/route.ts` | GET, PATCH, DELETE | `getPlacement(biz, id)`, `updatePlacement(biz, id, data)`, `deletePlacement(biz, id)` |
| `service-placements/[id]/complete/route.ts` | POST | `terminatePlacement(biz, id)` — sets status=TERMINATED |
| `service-recipients/route.ts` | GET, POST | `listRecipients(biz, filters)`, `createRecipient(biz, data)` — PII masking |
| `service-recipients/[id]/route.ts` | GET, PATCH, DELETE | `getRecipient(biz, id)`, `updateRecipient(biz, id, data)`, `deleteRecipient(biz, id)` |
| `service-recipients/[id]/documents/route.ts` | GET, POST | `listRecipientDocuments(biz, id)`, `addRecipientDocument(biz, id, data)` |
| `service-recipients/export/route.ts` | GET | `exportRecipients(biz)` |
| `service-recipient-stages/route.ts` | GET, POST | `listRecipientStages(biz)`, `upsertDefaultStages(biz)` |
| `service-recipient-stages/[id]/route.ts` | PATCH, DELETE | `updateRecipientStage(biz, id, data)`, `deleteRecipientStage(biz, id)` |
| `service-compliance/route.ts` | GET | `listComplianceItems(biz)` |
| `service-compliance/[id]/route.ts` | PATCH | `updateComplianceItem(biz, id, data)` |

---

## Domain: `booking` (public) → **SKIP — no service layer**

Public booking portal (`book/[slug]/*` and `booking/*`) has no `businessId` from session.
These routes use `DEMO_BUSINESS_ID` or slug-based lookup. Keep as pure routes.

| Route | Reason to Skip |
|-------|---------------|
| `book/[slug]/route.ts` | Public — slug lookup, no auth |
| `book/[slug]/slots/route.ts` | Public — availability calculation |
| `book/[slug]/booking/route.ts` | Public — customer self-booking |
| `book/[slug]/customer/route.ts` | Public — customer lookup/create |
| `booking/availability/route.ts` | Admin view of booking availability |
| `booking/blocks/route.ts` | Admin booking blocks |
| `booking/bookings/route.ts` | Admin pending bookings list |
| `booking/book/route.ts` | Admin approve/reject booking |
| `booking/slots/route.ts` | Admin slot view |

---

## Skip List (do not extract)

| Namespace | Reason |
|-----------|--------|
| `auth/*` | Auth is infrastructure, not business logic |
| `account/*` | User account management — not business-scoped |
| `cardcom/*` | **NEVER TOUCH** — 5-layer billing security |
| `webhooks/*` | External webhooks — side effects only |
| `cron/*` | Scheduled job orchestrators — call services, don't define them |
| `owner/*` | Platform admin — super-admin only |
| `admin/[businessId]/*` | Platform admin — super-admin only |
| `admin/migration/*` | Data migration — one-time scripts |
| `admin/broadcast-messages/*` | Platform admin only |
| `billing/*` | Billing events — infrastructure |
| `subscription/*` | Billing — Cardcom-adjacent |
| `seed/*` | Dev only |
| `support/*` | Bug reports — infrastructure |
| `tos/*` | Legal ToS acceptance — infrastructure |
| `sign/*` | Contract signing — public token auth |
| `boarding/*` in gcal | Calendar integration — gcal module |
| `integrations/*` | WhatsApp/GCal/OAuth — keep as routes |

---

## Extraction Order (Phase 0 schedule)

| Step | Domain | Complexity | Reason for order |
|------|--------|-----------|-----------------|
| 0.3 | `clients` | Medium | Most MCP-useful; isolated; no calendar/WhatsApp side effects in reads |
| 0.4 | `pets` | Low | Simple CRUD, no external deps |
| 0.5 | `appointments` | High | Calendar sync + reminders; most complex side effects |
| 0.6 | `boarding` | Medium | Room capacity logic; calendar |
| 0.7 | `training` | Medium | Group sessions + reminders; already has reminder-service |
| 0.8 | `orders` | High | VAT, invoicing, payment auto-creation |
| 0.9 | `business` | Low | Settings + analytics reads; mostly reads |
| 0.10 | `notifications` | Medium | Templates + scheduled sends |
| 0.11 | `service-dogs` | High | Largest domain; complex JSON fields; skip during MCP v1 |

---

## Service function signature standard

```typescript
// Every function follows this pattern:
export async function listCustomers(
  businessId: string,
  prismaClient: PrismaClient,
  filters?: { search?: string; page?: number; limit?: number }
): Promise<Customer[]> { ... }

// Side-effect functions (create/update/delete) return the created/updated entity:
export async function createCustomer(
  businessId: string,
  prismaClient: PrismaClient,
  data: CreateCustomerInput
): Promise<Customer> { ... }
```

**No `Request`, `Response`, `NextRequest`, `NextResponse` in service files — ever.**
Side effects (WhatsApp, GCal, email) are called from the API route after the service function returns.
