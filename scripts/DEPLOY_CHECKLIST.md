# Pre-Deploy Checklist — Petra App

Run through this list before every production release.
All boxes must be checked before merging the PR.

---

## Staging Verification

- [ ] Tested all new features on the staging URL
- [ ] Tested any modified existing features (regression check)
- [ ] No console errors in the browser (open DevTools → Console)
- [ ] No failed network requests (open DevTools → Network, filter by status 4xx/5xx)
- [ ] Checked on mobile (or browser responsive mode at 375px width)

## Database

- [ ] `prisma/schema.production.prisma` is in sync with `prisma/schema.prisma`
      (`diff prisma/schema.prisma prisma/schema.production.prisma` returns nothing)
- [ ] Any new columns have default values — no breaking changes to existing rows
- [ ] If columns were removed: no code still references them in any route

## Environment Variables

- [ ] Any new `.env` variables are also set in Vercel **Production** environment
      (Vercel dashboard → Project → Settings → Environment Variables → Production)
- [ ] Any new `.env` variables are also set in Vercel **Staging** environment if needed

## Communication

- [ ] If any breaking change (UI moved, flow changed, data deleted):
      told active users in advance via WhatsApp/email
- [ ] If any downtime expected: scheduled for off-hours (not Friday afternoon)

## Final Check

- [ ] Ran `npm run build` locally and it succeeds with zero errors
- [ ] Staging Vercel deployment shows ✅ (not ❌ or 🟡)
- [ ] Reviewed the PR diff — no accidental debug logs, console.logs, or test data

---

## How to deploy after completing this checklist

```bash
# 1. Open the PR (or check if it already exists)
npm run deploy:production

# 2. Go to the GitHub PR link printed above
# 3. Approve the PR (Settings → require 1 approval even as sole developer)
# 4. Merge the PR → Vercel auto-deploys main to production
```

---

## Rollback procedure

If production breaks after deploy:

```bash
# Option A: Revert the merge commit (safe, creates a new commit)
git checkout main
git pull origin main
git revert -m 1 HEAD  # revert the merge commit
git push origin main
# → Vercel auto-deploys the revert

# Option B: Use Vercel instant rollback (fastest)
# Vercel dashboard → Deployments → click previous successful deployment → Promote to Production
```
