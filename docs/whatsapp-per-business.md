# WhatsApp per-business (Meta Embedded Signup + Coexistence)

**Goal:** every business connects its OWN WhatsApp Business number; Petra sends reminders / confirmations / lead alerts from that number. Businesses without a connection keep using the platform number (`META_PHONE_NUMBER_ID`) — zero behavior change.

## Architecture
```
Settings → אינטגרציות → WhatsAppConnectCard  (FB JS SDK, Embedded Signup popup)
   │  code + phone_number_id + waba_id
   ▼
POST /api/integrations/whatsapp/connection   → connectWhatsAppBusiness()
   code → business-integration token (GET /oauth/access_token)
   verify phone (GET /{phone_number_id}) · subscribe app (POST /{waba}/subscribed_apps) · register (POST /{phone}/register)
   upsert WhatsAppConnection (token AES-256-GCM) · syncWhatsAppTemplates()
   ▼
sendWhatsAppMessage / sendWhatsAppTemplate({ businessId, … })
   resolveWhatsAppSender(businessId, { templateName })
     active connection + template APPROVED on the business WABA → business number
     else → platform number
   business auth error → connection.status="error" + one retry via platform
   ▼
Webhook /api/webhooks/whatsapp-status  (all WABAs subscribed to our app)
   statuses keyed by wamid · metadata.phone_number_id → businessId · optional X-Hub-Signature-256
```

## Models
- `WhatsAppConnection` — one per business (`businessId` unique, `phoneNumberId` unique). `status` active | disconnected | error. `templatesJson` = `{ name: APPROVED|PENDING|REJECTED|… }` on the business WABA. Token in `accessTokenEnc` (`WHATSAPP_ENCRYPTION_KEY`, falls back to `GCAL_ENCRYPTION_KEY`). Disconnect blanks the token.
- `WhatsAppMessageLog.businessId` / `.phoneNumberId` — which business / which sender.

## Routes
| Method | Path | Who |
|---|---|---|
| GET | `/api/integrations/whatsapp/connection` | any member |
| POST | `/api/integrations/whatsapp/connection` `{code, phoneNumberId, wabaId, coexistence}` | owner/manager (or platform admin), tier `whatsapp_reminders`, 5/10min |
| DELETE | `/api/integrations/whatsapp/connection` | owner/manager |
| POST | `/api/integrations/whatsapp/connection/sync-templates` | owner/manager, 3/10min |
| POST | `/api/integrations/whatsapp/test` `{phone}` | member — now sends from the business number when connected |

## Env (Vercel)
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_META_APP_ID` | Meta app id (client + server) |
| `NEXT_PUBLIC_META_ES_CONFIG_ID` | Embedded Signup configuration id (Meta app → WhatsApp → Embedded Signup) |
| `META_APP_SECRET` | code exchange + webhook signature verification |
| `META_WABA_ID` | platform WABA (default `25882288788086856`) — template source for sync |
| `WHATSAPP_ENCRYPTION_KEY` | optional 64-hex; else `GCAL_ENCRYPTION_KEY` |
| `WHATSAPP_REGISTER_PIN` | optional 6-digit two-step pin used on `/register` (default `000000`) |
The card shows "בקרוב" until the first three are set (`signupAvailable=false`).

## One-time Meta setup (owner — ~1h of forms, then days/weeks of review)
1. **Business verification** for the Petra Meta Business (Business Settings → Security Center). Required for Tech Provider.
2. Meta app (the one that owns `META_WHATSAPP_TOKEN`) → **App Review**: request `whatsapp_business_management` + `whatsapp_business_messaging` (Advanced Access) + `business_management`. Provide a screencast of the Petra connect flow (the card works against the test number before approval).
3. App → WhatsApp → **Embedded Signup** → create configuration (enable "Coexistence / WhatsApp Business App onboarding" if offered) → copy **Configuration ID** → `NEXT_PUBLIC_META_ES_CONFIG_ID`. App ID → `NEXT_PUBLIC_META_APP_ID`. App Settings → Basic → App Secret → `META_APP_SECRET`.
4. App → WhatsApp → Configuration → Webhook callback `https://petra-app.com/api/webhooks/whatsapp-status`, verify token = `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, subscribe to `messages` (statuses arrive under it). Already done for the platform WABA; business WABAs are auto-subscribed by `connectWhatsAppBusiness`.
5. Add `https://petra-app.com` to App Domains + "Valid OAuth Redirect URIs" (`https://petra-app.com/settings`) and switch the app to **Live** mode.
6. Optional: apply as **Tech Provider** / Solution Partner for billing on behalf of businesses; otherwise each business pays Meta directly from its own WABA (they add a payment method in WhatsApp Manager — the card links there).

## Customer-side requirements (what the business owner needs)
- A Facebook account with admin rights on the business's Meta Business (or lets the flow create one).
- A phone number **not** registered on the consumer WhatsApp app. With **Coexistence** it can be the number already used in the **WhatsApp Business app** (the app stays usable; the flow asks to scan a QR in the app). Without coexistence the number must be free (or be removed from the app first).
- SMS/voice verification during the popup.

## Templates
On connect (and via "סנכרן תבניות") every APPROVED platform template is copied to the business WABA and submitted for review (usually minutes; status tracked in `templatesJson`). Until a template is APPROVED on the business WABA, that template is still sent from the platform number — so automation never breaks mid-migration.

## Testing without a Meta app (QA)
- `GET /api/integrations/whatsapp/connection` → `status:"none", signupAvailable:false`.
- Connect with a bogus code → 400 Hebrew error, no row written.
- A row with an invalid token (status active) → send falls back to platform, row flips to `error` with `lastError` (resilience path).
