#!/usr/bin/env node
/**
 * Build gate — no NEW free-text WhatsApp sends to customers (runs in `build` / `vercel-build`).
 *
 * Meta delivers free text only inside the 24h window after the customer last wrote to the
 * number. Every failure in Oct 2026 (follow-ups, confirmations, reminders) was free text;
 * template sends had zero failures. So a customer-facing automated message goes through
 * `sendWithTemplateChain()` with an approved template (CLAUDE.md rule #26), and every
 * remaining direct `sendWhatsAppMessage()` call is listed here with a reason.
 *
 * Adding a call (or a new file) fails the build on purpose: use a template chain, or add
 * the site with an honest reason. KNOWN_GAP = customer-facing free text that still needs a
 * template — remove the entry when it gets one (a stale entry fails too).
 * Test: src/lib/__tests__/whatsapp-free-text-guard.test.ts
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/** kind: OWNER | BY_DESIGN | FALLBACK | KNOWN_GAP */
const ALLOWED_FREE_TEXT = {
  // Last-resort fallbacks after a template chain / template attempt
  "lib/whatsapp-template-chain.ts": { count: 1, kind: "FALLBACK", why: "free text after every template step failed" },
  "lib/whatsapp.ts": { count: 1, kind: "FALLBACK", why: "sendWhatsAppTemplate() fallback when Meta is not configured" },
  "lib/payment-request.ts": { count: 3, kind: "FALLBACK", why: "after petra_payment_request" },
  "lib/lead-alert.ts": { count: 1, kind: "FALLBACK", why: "owner alert after petra_biz_lead_alert" },
  // To the business owner / the person who is using the app right now
  "lib/security-alerts.ts": { count: 1, kind: "OWNER", why: "security alert to the business owner" },
  "app/api/sign/[token]/route.ts": { count: 1, kind: "OWNER", why: "contract signed → business phone" },
  "app/api/book/[slug]/booking/route.ts": { count: 4, kind: "KNOWN_GAP", why: "2 to the owner; booking_confirmation + booking_pending to the customer need templates" },
  "app/api/settings/route.ts": { count: 1, kind: "BY_DESIGN", why: "test message to the user's own phone" },
  "app/api/integrations/whatsapp/test/route.ts": { count: 1, kind: "BY_DESIGN", why: "connection test message" },
  // Typed by the business for one customer, right now (UI explains the 24h window)
  "app/api/customers/[id]/whatsapp/route.ts": { count: 1, kind: "BY_DESIGN", why: "manual message from the customer card" },
  // Customer-facing free text that still needs an approved template
  "app/api/appointments/[id]/remind/route.ts": { count: 1, kind: "KNOWN_GAP", why: "manual reminder button — use appointmentReminderChain" },
  "app/api/mcp/route.ts": { count: 1, kind: "KNOWN_GAP", why: "MCP send_reminder — use appointmentReminderChain" },
  "app/api/booking/book/route.ts": { count: 2, kind: "KNOWN_GAP", why: "online booking request received" },
  "app/api/booking/bookings/[id]/route.ts": { count: 1, kind: "KNOWN_GAP", why: "online booking approved / declined" },
  "app/api/contracts/send/route.ts": { count: 1, kind: "KNOWN_GAP", why: "contract link to the customer" },
  "app/api/contracts/requests/[id]/resend/route.ts": { count: 2, kind: "KNOWN_GAP", why: "contract link resend" },
  "app/api/cron/online-class-reminders/route.ts": { count: 1, kind: "KNOWN_GAP", why: "online class reminder to students" },
  "app/api/cron/online-classes-engagement/route.ts": { count: 1, kind: "KNOWN_GAP", why: "online classes engagement nudge" },
  "services/online-classes.ts": { count: 2, kind: "KNOWN_GAP", why: "membership approved / class notices to students" },
  "services/portal.ts": { count: 1, kind: "KNOWN_GAP", why: "customer portal notice" },
  "services/lesson-qa.ts": { count: 1, kind: "KNOWN_GAP", why: "lesson Q&A answer to the student" },
  "services/certificates.ts": { count: 1, kind: "KNOWN_GAP", why: "certificate issued" },
  "services/certificate-admin.ts": { count: 1, kind: "KNOWN_GAP", why: "certificate issued (admin)" },
};


/** Files that queue customer ScheduledMessages WITHOUT a templateChain (body only). */
const ALLOWED_SCHEDULED_WITHOUT_CHAIN = {
  "app/api/orders/route.ts": "appointment_confirmation_log — a record of a send that already happened, never sent by the cron",
  "app/api/appointments/route.ts": "appointment_confirmation_log — record only",
  "lib/scheduled-messages.ts": "generic createScheduledMessage helper; callers pass the payload",
  "app/api/cron/vaccination-reminders/route.ts": "KNOWN_GAP — vaccination reminder needs a template",
  "app/api/cron/birthday-reminders/route.ts": "KNOWN_GAP — pet birthday greeting needs a template",
};


const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "__tests__" || e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(SRC).map((abs) => ({
  rel: path.relative(SRC, abs).split(path.sep).join("/"),
  text: fs.readFileSync(abs, "utf8"),
}));
const byRel = new Map(files.map((f) => [f.rel, f.text]));
/** Calls only — not the function's own declaration. */
const calls = (text) => (text.match(/(?<!function\s)\bsendWhatsAppMessage\(/g) ?? []).length;

const problems = [];
for (const f of files) {
  const n = calls(f.text);
  if (n === 0) continue;
  const allowed = ALLOWED_FREE_TEXT[f.rel];
  if (!allowed) problems.push(`${f.rel}: ${n} free-text WhatsApp send(s) — use sendWithTemplateChain() or list it with a reason`);
  else if (n > allowed.count) problems.push(`${f.rel}: ${n} free-text sends, ${allowed.count} allowed (${allowed.why})`);
}
for (const [rel, a] of Object.entries(ALLOWED_FREE_TEXT)) {
  const n = calls(byRel.get(rel) ?? "");
  if (n < a.count) problems.push(`${rel}: allowlist says ${a.count}, found ${n} — shrink the entry`);
}
for (const f of files) {
  if (/scheduledMessage\.create\(/.test(f.text) && !/templateChain/.test(f.text) && !ALLOWED_SCHEDULED_WITHOUT_CHAIN[f.rel]) {
    problems.push(`${f.rel}: queues a scheduled WhatsApp without templateChain`);
  }
}

if (problems.length) {
  console.error("\n✖ WhatsApp free-text guard (scripts/audit-whatsapp-free-text.mjs):\n  " + problems.join("\n  ") + "\n");
  process.exit(1);
}
const gaps = Object.values(ALLOWED_FREE_TEXT).filter((a) => a.kind === "KNOWN_GAP").length
  + Object.values(ALLOWED_SCHEDULED_WITHOUT_CHAIN).filter((w) => w.startsWith("KNOWN_GAP")).length;
console.log(`✓ WhatsApp free-text guard: no new free-text sends (${gaps} known gaps listed)`);
