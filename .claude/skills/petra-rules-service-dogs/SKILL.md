---
name: petra-rules-service-dogs
description: "Petra service-dog module invariants moved out of CLAUDE.md (rules 12-15): SERVICE_DOG_PHASES single source of truth and VALID_PHASES, recipient stages with REJECTED as the archive stage, the two placement statuses (ACTIVE/TERMINATED), SERVICE_DOG_TYPES incl. PTSD. Load BEFORE touching src/lib/service-dogs.ts, /api/service-dogs/*, /api/service-recipient-stages, service-dog or recipient pages, placements, phases or medical protocols."
---

# Petra — Service dogs — rules

Moved verbatim out of `CLAUDE.md` (always loaded) into this lazy skill. Rule numbers are unchanged, so "CLAUDE.md rule N" references still resolve through the routing table in `CLAUDE.md`.

### 12. Service dog phases — single source of truth
`SERVICE_DOG_PHASES` in `src/lib/service-dogs.ts` drives ALL phase UI and API validation.
`VALID_PHASES` in `/api/service-dogs/[id]/phase/route.ts` is derived from it — never hardcode phase strings elsewhere.
Current order: SELECTION → RAISING → PUPPY → IN_TRAINING → ADVANCED_TRAINING → CERTIFIED → RETIRED → DECERTIFIED

### 13. Recipient stages — REJECTED = archive
`DEFAULT_STAGES` in `/api/service-recipient-stages/route.ts` is upserted (name + color) on every GET.
`REJECTED` is the only "archive" stage — hidden by default in kanban + table; toggled by "ארכיון" button.
`activeStages = stages.filter(s => showArchive || s.key !== "REJECTED")` pattern in recipients page.
AddRecipientModal receives stages filtered without REJECTED.

### 14. Placement statuses — only 2
`SERVICE_DOG_PLACEMENT_STATUSES` = `ACTIVE` (פעיל) + `TERMINATED` (הסתיים).
No PENDING / TRIAL / SUSPENDED / COMPLETED. New placements default to `ACTIVE`.
`activePlacement` filter: `p.status === "ACTIVE"` (not `|| "TRIAL"`).

### 15. Service dog types — includes PTSD
`SERVICE_DOG_TYPES` in `src/lib/service-dogs.ts`: MOBILITY, PSYCHIATRIC, PTSD, GUIDE, AUTISM, ALERT, OTHER.
