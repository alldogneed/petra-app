---
name: petra-rules-whatsapp
description: "Petra WhatsApp sending invariants moved out of CLAUDE.md (rule 26 + the per-business numbers section): the ordered template chain (UTILITY → legacy MARKETING → free text), META_TEMPLATES and *Chain() builders, ScheduledMessage payload shape, always passing businessId + context, resolveWhatsAppSender, per-business numbers via Meta Embedded Signup, token encryption, connection routes, the status webhook. Load BEFORE touching whatsapp*.ts, reminder-service.ts, scheduled messages, WhatsAppConnection, /api/integrations/whatsapp/*, /api/webhooks/whatsapp-status or any code that sends a WhatsApp message."
---

# Petra — WhatsApp — rules

Moved verbatim out of `CLAUDE.md` (always loaded) into this lazy skill. Rule numbers are unchanged, so "CLAUDE.md rule N" references still resolve through the routing table in `CLAUDE.md`.

### 26. Automated customer WhatsApp sends go through the ordered template chain
`src/lib/whatsapp-template-chain.ts` — `sendWithTemplateChain()` tries an ordered list of Meta template names and only then sends free text (24h window only). All names live in `META_TEMPLATES` (`src/lib/reminder-service.ts`) with a `*Chain()` builder per flow; `buildTemplateChain()` drops any step with an empty param (Meta rejects them).
```
UTILITY template  →  legacy (MARKETING) template  →  free text
```
- Meta silently frequency-caps MARKETING templates per recipient (API says `accepted`, nothing delivered). A new UTILITY name is added at the **front** of the chain — never in place of the older names (an unapproved name is rejected at send time and skipped; a replaced name would drop the flow to free text).
- ScheduledMessage payloads carry `flow` (→ `WhatsAppMessageLog.context`, e.g. `lead_followup`) + `templateChain: [{ name, params }]`. `chainFromPayload()` still reads the legacy `metaTemplateName`/`metaTemplateParams` shape for rows already queued.
- `processPendingReminders()` and `POST /api/scheduled-messages/[id]/send` both use the chain; **always pass `businessId` + `context`**. Sender selection stays in `resolveWhatsAppSender()` — no parallel mechanism.
- Do not add chain names to `PLATFORM_TEMPLATE_NAMES` (`whatsapp-connections.ts`) unless the template really exists on the platform WABA — that list feeds `missingTemplates` in the connection UI.

---

## WhatsApp — per-business numbers (Meta Embedded Signup)

Full doc: `docs/whatsapp-per-business.md`.
- `sendWhatsAppMessage` / `sendWhatsAppTemplate` accept `businessId?` + `context?`. **Always pass `businessId`** from any caller that has one — `resolveWhatsAppSender()` (`src/lib/whatsapp-connections.ts`) picks the business's own number when `WhatsAppConnection.status === "active"` **and** the template is APPROVED on its WABA (`templatesJson`), otherwise the platform number (`META_PHONE_NUMBER_ID`). Business auth failure → connection flips to `error` + one retry via platform. Unconnected businesses behave exactly as before.
- Token stored AES-256-GCM in `accessTokenEnc` (`WHATSAPP_ENCRYPTION_KEY`, fallback `GCAL_ENCRYPTION_KEY`); disconnect blanks it. Never log it.
- Routes: `GET/POST/DELETE /api/integrations/whatsapp/connection` (+ `/sync-templates`). POST/DELETE = owner/manager/platform-admin; POST needs tier `whatsapp_reminders` + `isWhatsAppEmbeddedSignupConfigured()`; `businessId` from session only.
- UI: `src/components/settings/WhatsAppConnectCard.tsx` inside Settings → אינטגרציות (FB JS SDK; CSP in `next.config.mjs` allows connect.facebook.net / www.facebook.com / graph.facebook.com). Shows "בקרוב" until `NEXT_PUBLIC_META_APP_ID` + `NEXT_PUBLIC_META_ES_CONFIG_ID` + `META_APP_SECRET` are set.
- Webhook `/api/webhooks/whatsapp-status` serves ALL subscribed WABAs; routes by `metadata.phone_number_id` → `findBusinessIdByPhoneNumberId`; verifies `X-Hub-Signature-256` when `META_APP_SECRET` is set.
- Prod DDL for new tables: additive SQL via `prisma db execute --url $DIRECT_URL` (never `db push`).
