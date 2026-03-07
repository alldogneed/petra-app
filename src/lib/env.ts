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
  // Required — app cannot start without a database connection.
  DATABASE_URL: required("DATABASE_URL"),
  DIRECT_URL: required("DIRECT_URL"),

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
