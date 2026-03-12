# Petra — Deployment & Infrastructure

## Branch Structure
| Branch | Purpose | Push policy |
|--------|---------|-------------|
| `dev` | Daily dev | Direct push ok |
| `staging` | Pre-production | Direct push ok |
| `main` | Production | **PR + approval only** |

## Workflow
```bash
# Daily dev
git push origin dev

# Deploy to staging (test first)
npm run deploy:staging   # merges current → staging, Vercel builds

# Deploy to production (after staging verified)
npm run deploy:production  # opens PR staging → main, requires approval
# After merge: Vercel auto-deploys
```

**Never push directly to `main`.**

## Rollback
```bash
# Option A — git revert
git checkout main && git pull origin main
git revert -m 1 HEAD
git push origin main

# Option B — Vercel dashboard instant rollback
# Deployments → previous ✅ deployment → Promote to Production
```

## Production Environment

### Business Accounts (Supabase)
| Email | businessId | Business |
|-------|-----------|---------|
| `alldogneed@gmail.com` | `6c51668f-00e9-46b1-9ba2-ff113831a172` | PRIMARY |
| `or.rabinovich@gmail.com` | `4c0cd6b3-c7a5-4c29-b8f4-1213ede4b893` | Secondary |

### URLs
- App: `https://petra-app.com`
- Booking: `https://petra-app.com/book/[slug]`
- Webhook: `https://petra-app.com/api/webhooks/lead`

### Required Vercel Env Vars
`DATABASE_URL`, `DIRECT_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GCAL_ENCRYPTION_KEY`, `INVOICING_ENCRYPTION_KEY`, `STRIPE_ENCRYPTION_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `META_WHATSAPP_TOKEN`, `META_PHONE_NUMBER_ID`, `META_WHATSAPP_BUSINESS_ACCOUNT_ID`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `MAKE_WEBHOOK_SECRET`, `WEBHOOK_BUSINESS_ID`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_APP_URL`

## Databases
- **Production**: Supabase `ipeshpbikcfcwkvkztxn` (aws-1-ap-northeast-2)
- **Staging**: Neon `ep-quiet-dream-aliw6zka.c-3.eu-central-1.aws.neon.tech`

### Schema sync after every migration
```bash
cp prisma/schema.prisma prisma/schema.production.prisma
git add prisma/schema.production.prisma
git commit -m "fix: sync production schema"
git push origin main
```
Vercel runs `prisma generate --schema=prisma/schema.production.prisma`. Stale schema = deployment failure.

## Vercel Settings
- **Production Branch**: `main`
- **Preview Branch**: `staging` → assign "Staging" environment
- Scope `DATABASE_URL`/`DIRECT_URL` separately for Production vs Preview (staging)

## GitHub Actions
- `.github/workflows/cron.yml` — `send-reminders` every 15min + `process-jobs` every 5min
- Requires `CRON_SECRET` in GitHub repo secrets

## WhatsApp (Meta Cloud API)
- System User: `petra API` | ID: `61582152564455`
- Phone: +972 51-531-1435 | `META_PHONE_NUMBER_ID=1079067058616014`
- `META_WHATSAPP_BUSINESS_ACCOUNT_ID=25882288788086856`
- Status: **Business Verification In Review** (submitted 9.3.2026)
