#!/usr/bin/env bash
# Petra App — Deployment helper script
# Usage: called by npm run deploy:staging | deploy:production

set -e  # exit immediately on any error

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# ─────────────────────────────────────────────
# deploy:staging
# Merges current branch → staging and pushes.
# Vercel automatically deploys staging branch
# to the staging environment.
# ─────────────────────────────────────────────
deploy_staging() {
  echo ""
  echo "▶ Deploying to STAGING"
  echo "  Current branch: $CURRENT_BRANCH"
  echo ""

  # Make sure working tree is clean
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "✗ You have uncommitted changes. Commit or stash them first."
    exit 1
  fi

  # Sync production schema before merging
  if ! diff -q prisma/schema.prisma prisma/schema.production.prisma > /dev/null 2>&1; then
    echo "⚠ schema.production.prisma is out of sync — updating it now..."
    cp prisma/schema.prisma prisma/schema.production.prisma
    git add prisma/schema.production.prisma
    git commit -m "fix: sync production schema before staging deploy"
  fi

  # Switch to staging and merge
  git checkout staging
  git merge "$CURRENT_BRANCH" --no-edit
  git push origin staging

  git checkout "$CURRENT_BRANCH"

  echo ""
  echo "✓ Pushed to staging. Vercel is now building the staging deployment."
  echo "  Check progress: https://vercel.com/alldogneed-9395s-projects/petra-app"
  echo ""
  echo "  When ready → run: npm run deploy:production"
  echo ""
}

# ─────────────────────────────────────────────
# deploy:production
# Opens a Pull Request from staging → main.
# Does NOT merge automatically.
# You must approve + merge in GitHub.
# ─────────────────────────────────────────────
deploy_production() {
  echo ""
  echo "▶ Creating Pull Request: staging → main (PRODUCTION)"
  echo ""

  # Make sure gh CLI is available
  if ! command -v gh &> /dev/null; then
    echo "✗ GitHub CLI (gh) is not installed."
    echo "  Install: https://cli.github.com"
    exit 1
  fi

  # Check for existing open PR
  EXISTING_PR=$(gh pr list --base main --head staging --state open --json number --jq '.[0].number' 2>/dev/null || echo "")
  if [ -n "$EXISTING_PR" ]; then
    echo "  An open PR already exists: #$EXISTING_PR"
    echo "  → https://github.com/alldogneed/petra-app/pull/$EXISTING_PR"
    echo ""
    echo "  Review it, approve it, and merge it in GitHub to deploy to production."
    exit 0
  fi

  # Create the PR
  PR_URL=$(gh pr create \
    --base main \
    --head staging \
    --title "Release to Production — $(date '+%Y-%m-%d')" \
    --body "$(cat <<'EOF'
## Release to Production

This PR merges staging → main to trigger a production deployment.

### Pre-deploy checklist
- [ ] Tested all new features on the staging URL
- [ ] No console errors in staging
- [ ] Checked on mobile
- [ ] Database migrations ready (schema.production.prisma in sync)
- [ ] Environment variables updated in Vercel Production settings
- [ ] Notified active users of any breaking changes

### How to deploy
1. Review this PR
2. Approve it
3. Merge it — Vercel will automatically deploy `main` to production

**Do not merge if any checklist item is not done.**
EOF
    )" 2>&1)

  echo ""
  echo "✓ Pull Request created:"
  echo "  $PR_URL"
  echo ""
  echo "  → Open the PR in GitHub, review it, and merge to deploy to production."
  echo "  → NEVER merge without going through the checklist."
  echo ""
}

# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
case "$1" in
  staging)    deploy_staging ;;
  production) deploy_production ;;
  *)
    echo "Usage: $0 [staging|production]"
    echo ""
    echo "  staging    — merge current branch → staging and push"
    echo "  production — open a PR from staging → main (requires manual approval)"
    exit 1
    ;;
esac
