/**
 * env.ts — Server-side environment variable validation and typed access.
 *
 * IMPORTANT: This module is SERVER-SIDE ONLY.
 * Never import it from a Client Component ("use client").
 * For client-side values, use process.env.NEXT_PUBLIC_* directly.
 *
 * Usage:
 *   import { env } from "@/lib/env";
 *   const url = env.APP_URL;
 */

// Guard: throw at module load time if accidentally bundled for the browser.
if (typeof window !== "undefined") {
  throw new Error(
    "[env.ts] This module must only be used on the server. " +
    "Use process.env.NEXT_PUBLIC_* for client-side values."
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function required(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(
      `[env] Missing required environment variable: ${key}\n` +
      `Check your .env.local file or Vercel project settings.`
    );
  }
  return val;
}

function optional(key: string, defaultVal = ""): string {
  return process.env[key] ?? defaultVal;
}

// ── Config ───────────────────────────────────────────────────────────────────

export const env = {
  // Runtime
  NODE_ENV: (process.env.NODE_ENV ?? "development") as
    | "development"
    | "test"
    | "production",

  // ── Database ───────────────────────────────────────────────────────────────
  // Required — but validated LAZILY (getter), only when actually read, so a
  // missing value throws at runtime with a clear message instead of at module
  // load. Eager validation broke Vercel builds: `next build` loads every route
  // module while "collecting page data", which imported this file and threw
  // when DATABASE_URL wasn't present at build time (e.g. Preview env). Prisma
  // reads process.env.DATABASE_URL directly from schema.prisma, so nothing in
  // the app reads these two at runtime — the getters are a validation safety
  // net, not a hot path.
  get DATABASE_URL(): string {
    return required("DATABASE_URL");
  },
  get DIRECT_URL(): string {
    return required("DIRECT_URL");
  },

  // ── App URLs ───────────────────────────────────────────────────────────────
  APP_URL: optional("APP_URL", "http://localhost:3000"),
  // NEXT_PUBLIC_APP_URL is accessible on the client via process.env directly.
  // Listed here for completeness but not re-exported to client.
  NEXT_PUBLIC_APP_URL: optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),

  // ── Google OAuth ───────────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: optional("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: optional("GOOGLE_CLIENT_SECRET"),
  GOOGLE_REDIRECT_URI: optional(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:3000/api/auth/google/callback"
  ),

  // ── Google Calendar ────────────────────────────────────────────────────────
  GCAL_REDIRECT_URI: optional(
    "GCAL_REDIRECT_URI",
    "http://localhost:3000/api/integrations/google/callback"
  ),
  GCAL_ENCRYPTION_KEY: optional("GCAL_ENCRYPTION_KEY"),

  // ── Cron ───────────────────────────────────────────────────────────────────
  CRON_SECRET: optional("CRON_SECRET"),

  // ── Email ──────────────────────────────────────────────────────────────────
  RESEND_API_KEY: optional("RESEND_API_KEY"),
  EMAIL_FROM: optional("EMAIL_FROM", "Petra <onboarding@resend.dev>"),

  // ── Invoicing ──────────────────────────────────────────────────────────────
  INVOICING_ENCRYPTION_KEY: optional("INVOICING_ENCRYPTION_KEY"),

  // ── Stripe ─────────────────────────────────────────────────────────────────
  STRIPE_ENCRYPTION_KEY: optional("STRIPE_ENCRYPTION_KEY"),

  // ── Webhooks / Make.com ────────────────────────────────────────────────────
  MAKE_WEBHOOK_SECRET: optional("MAKE_WEBHOOK_SECRET"),
  WEBHOOK_BUSINESS_ID: optional("WEBHOOK_BUSINESS_ID"),

  // ── Vercel Blob ────────────────────────────────────────────────────────────
  BLOB_READ_WRITE_TOKEN: optional("BLOB_READ_WRITE_TOKEN"),

  // ── Twilio / WhatsApp ──────────────────────────────────────────────────────
  TWILIO_ACCOUNT_SID: optional("TWILIO_ACCOUNT_SID"),
  TWILIO_AUTH_TOKEN: optional("TWILIO_AUTH_TOKEN"),
  TWILIO_WHATSAPP_FROM: optional("TWILIO_WHATSAPP_FROM", "+14155238886"),
} as const;

export type Env = typeof env;

// ── Helpers exported for convenience ─────────────────────────────────────────

/** Returns true when running in local development */
export const isDev = env.NODE_ENV === "development";

/** Returns true when running on staging (Vercel preview of the staging branch) */
export const isStaging =
  env.NODE_ENV === "production" &&
  env.APP_URL.includes("staging");

/** Returns true when running in production */
export const isProd =
  env.NODE_ENV === "production" && !isStaging;

/**
 * Resolve the public origin for links we send to customers (e.g. contract
 * sign URLs). Normally this is env.APP_URL, but if APP_URL is unset or still
 * pointing at localhost while running in production, derive the origin from
 * the incoming request's forwarded headers instead — a localhost link sent
 * to a customer's phone is useless.
 */
export function resolvePublicOrigin(request: Request): string {
  const configured = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  const isMisconfigured = !configured || configured.includes("localhost") || configured.includes("127.0.0.1");

  if (env.NODE_ENV === "production" && isMisconfigured) {
    const host =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (host) {
      const proto = request.headers.get("x-forwarded-proto") ?? "https";
      return `${proto}://${host}`;
    }
  }

  return configured || env.APP_URL.replace(/\/+$/, "");
}
