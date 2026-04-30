#!/usr/bin/env node
/**
 * audit-route-auth.mjs
 *
 * Static audit of every API route under src/app/api/route.ts. Each route MUST
 * either:
 *   1. use an authorization helper (requireBusinessAuth, requireTenantPermission,
 *      requirePlatformPermission, verifyCronAuth, getSession with an explicit
 *      `if (!session) return 401` check), OR
 *   2. be on the explicit PUBLIC_ROUTES allowlist below — auth-free public
 *      endpoints (signup, public booking, webhooks).
 *
 * Anything else fails the audit. Exits 1 if violations are found, suitable
 * for use in CI / pre-build hooks. Exits 0 when clean.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const API_DIR = join(ROOT, "src", "app", "api");

// Routes that are intentionally public (no session needed).
// Each entry is the route path relative to src/app/api/, without /route.ts.
const PUBLIC_ROUTES = new Set([
  // ── Auth flow ─────────────────────────────────────────────────────────────
  "auth/login",
  "auth/logout",
  "auth/register",
  "auth/forgot-password",
  "auth/reset-password",
  "auth/session",
  "auth/me",
  "auth/2fa/enroll",
  "auth/2fa/verify",
  "auth/2fa/confirm",
  "auth/exit-impersonation",
  "auth/google",
  "auth/google/callback",

  // ── Public booking flow (anonymous customers) ─────────────────────────────
  "book/[slug]",
  "book/[slug]/booking",
  "book/[slug]/customer",
  "book/[slug]/customer-lookup",
  "book/[slug]/slots",
  "booking/availability",
  "booking/slots",
  "booking/book",
  "my-booking/[token]",

  // ── Intake forms (token-protected, no session) ────────────────────────────
  "intake/[token]",
  "intake/[token]/submit",

  // ── Contract signing (token-protected) ────────────────────────────────────
  "sign/[token]",

  // ── CardCom payment redirects (signed by CardCom, no session) ─────────────
  "cardcom/indicator",
  "cardcom/success-redirect",
  "cardcom/create-trial",
  "cardcom/create-checkout",
  "cardcom/checkout-indicator",
  "cardcom/trial-indicator",

  // ── Cron jobs (auth via verifyCronAuth, but pattern detector below) ───────
  // Listed here so PUBLIC heading shows them clearly. Each must still call
  // verifyCronAuth — the pattern check below enforces that.

  // ── Webhooks (auth in-route via secret/signature) ─────────────────────────
  "webhooks/stripe",
  "webhooks/cardcom",
  "webhooks/paycall",
  "webhooks/invoices",
  "webhooks/lead",

  // ── Internal health/utility ───────────────────────────────────────────────
  "test-notify",

  // ── Service-dog public ID-card (token-protected) ──────────────────────────
  "service-dogs/id-card/[token]",

  // ── Contract sign PDF (token-protected) ───────────────────────────────────
  "sign/[token]/pdf",

  // ── Invoice job processor (cron-style with internal secret) ───────────────
  "invoicing/process-jobs",
]);

// Patterns indicating the route IS authenticated. ANY of these is enough.
const AUTH_PATTERNS = [
  /requireBusinessAuth\s*\(/,
  /requireTenantPermission\s*\(/,
  /requirePlatformPermission\s*\(/,
  /requirePlatformRole\s*\(/,
  /requireAuth\s*\(/,
  /verifyCronAuth\s*\(/,
  /resolveSession\s*\(/,
  /getCurrentUser\s*\(/,
];

const TOKEN_AUTH_PATTERNS = [
  // For webhook-style routes that authenticate via a query/body secret:
  /timingSafeEqual\s*\(/,
  /WEBHOOK_SECRET/,
  /CRON_SECRET/,
  /verify\w*Signature\s*\(/,        // verifyMorningWebhookSignature, verifyStripeSignature, etc.
  /constructEvent\s*\(/,             // stripe.webhooks.constructEvent
  /signatureValid/,                   // common variable name
  /webhookSecret/i,
];

function listRouteFiles(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listRouteFiles(full, prefix ? `${prefix}/${entry}` : entry));
    } else if (entry === "route.ts") {
      out.push({ path: prefix, file: full });
    }
  }
  return out;
}

function checkSessionWithBranch(content) {
  if (!/getSession\s*\(/.test(content)) return false;
  // Must also have a !session branch — either a status response or a redirect
  return /Unauthorized|401|403/.test(content) || /if\s*\(\s*!\s*session/.test(content);
}

function isCronRoute(routePath) {
  return routePath.startsWith("cron/") || routePath === "cron";
}

const routes = listRouteFiles(API_DIR);
const violations = [];

for (const { path: routePath, file } of routes) {
  const isPublic = PUBLIC_ROUTES.has(routePath);
  const isCron = isCronRoute(routePath);
  const content = readFileSync(file, "utf8");

  const hasGuard = AUTH_PATTERNS.some((rx) => rx.test(content)) || checkSessionWithBranch(content);
  const hasTokenAuth = TOKEN_AUTH_PATTERNS.some((rx) => rx.test(content));

  if (isCron) {
    // Cron routes must use verifyCronAuth specifically
    if (!/verifyCronAuth\s*\(/.test(content)) {
      violations.push({
        route: routePath,
        file: relative(ROOT, file),
        reason: "cron route missing verifyCronAuth()",
      });
    }
    continue;
  }

  if (isPublic) {
    // Public webhooks should still use token auth
    if (routePath.startsWith("webhooks/") && !hasTokenAuth) {
      violations.push({
        route: routePath,
        file: relative(ROOT, file),
        reason: "webhook route on PUBLIC list but lacks token verification",
      });
    }
    continue;
  }

  if (!hasGuard) {
    violations.push({
      route: routePath,
      file: relative(ROOT, file),
      reason:
        "no auth helper detected. Use requireBusinessAuth/requireTenantPermission/" +
        "requirePlatformPermission/verifyCronAuth, or add to PUBLIC_ROUTES allowlist.",
    });
  }
}

console.log(`Audited ${routes.length} API routes.`);
if (violations.length === 0) {
  console.log("✓ No auth gaps found.");
  process.exit(0);
}

console.error(`\n✗ ${violations.length} potential auth gap(s):\n`);
for (const v of violations) {
  console.error(`  ${v.route}`);
  console.error(`    ${v.file}`);
  console.error(`    → ${v.reason}\n`);
}
process.exit(1);
