/**
 * Login alerts: detect new devices/locations on sign-in and notify the user.
 *
 * Fingerprinting:
 *   - Browser family (Chrome/Safari/Firefox/Edge/Other)
 *   - OS family (macOS/Windows/iOS/Android/Linux/Other)
 *   - Country from Vercel's x-vercel-ip-country header
 *
 * Comparison key uses browser+os only (not country) to avoid alert fatigue for
 * travelers / VPN users. Country+city are shown in the email body for context.
 *
 * A "new device" is one whose browser+os combination hasn't been seen in any
 * session created in the last 90 days.
 */

import prisma from "./prisma";
import { sendEmail, brandHeader, brandFooter } from "./email";

const LOOKBACK_DAYS = 90;

export interface DeviceFingerprint {
  browser: string;
  os: string;
  country: string;
  city: string;
  /** Comparison key: browser + os (country intentionally excluded). */
  key: string;
  userAgent: string;
  ipAddress: string;
}

function parseBrowser(ua: string): string {
  if (!ua) return "Other";
  if (/Edg/i.test(ua)) return "Edge";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) return "Chrome";
  if (/Firefox|FxiOS/i.test(ua)) return "Firefox";
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  return "Other";
}

function parseOS(ua: string): string {
  if (!ua) return "Other";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Other";
}

/** Build a device fingerprint from the incoming request. */
export function fingerprintRequest(request: Request): DeviceFingerprint {
  const headers = request.headers;
  const ua = headers.get("user-agent") || "";
  const browser = parseBrowser(ua);
  const os = parseOS(ua);
  const country = headers.get("x-vercel-ip-country") || "";
  const city = decodeURIComponent(headers.get("x-vercel-ip-city") || "");
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  return {
    browser,
    os,
    country,
    city,
    key: `${browser}|${os}`,
    userAgent: ua,
    ipAddress: ip,
  };
}

/**
 * Fetch the set of known device fingerprints (browser+os keys) for a user,
 * derived from their AdminSession history in the last 90 days.
 */
export async function getKnownFingerprints(userId: string): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const sessions = await prisma.adminSession.findMany({
    where: { userId, createdAt: { gte: cutoff } },
    select: { userAgent: true },
  });
  return new Set(
    sessions.map((s) => `${parseBrowser(s.userAgent || "")}|${parseOS(s.userAgent || "")}`)
  );
}

/** Friendly device description for emails: "Chrome on macOS" */
export function formatDevice(fp: DeviceFingerprint): string {
  const osLabel =
    fp.os === "iOS" ? "iPhone/iPad" : fp.os === "Android" ? "Android" : fp.os;
  return `${fp.browser} on ${osLabel}`;
}

/** Friendly location string: "Tel Aviv, IL" — empty if nothing known. */
export function formatLocation(fp: DeviceFingerprint): string {
  return [fp.city, fp.country].filter(Boolean).join(", ");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Send the "new device login" alert email (Hebrew RTL, Petra brand). */
export async function sendNewDeviceAlertEmail(params: {
  to: string;
  name: string | null;
  fp: DeviceFingerprint;
  when: Date;
  method: "password" | "google";
}): Promise<void> {
  const appUrl = process.env.APP_URL || "https://petra-app.com";
  const securityUrl = `${appUrl}/settings?tab=security`;
  const name = params.name?.trim() || params.to.split("@")[0];
  const device = formatDevice(params.fp);
  const location = formatLocation(params.fp) || "מיקום לא ידוע";
  const whenLabel = params.when.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  });
  const methodLabel = params.method === "google" ? "Google" : "סיסמה";

  const html = `
    <div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b;background:#ffffff;">
      ${brandHeader()}
      <div style="padding:24px;border:1px solid #e2e8f0;border-top:none;">
        <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#1e293b;">🔔 התראת אבטחה</h2>
        <p style="margin:0 0 12px;font-size:15px;">שלום ${escape(name)},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
          זיהינו התחברות לחשבון שלך ב-Petra ממכשיר או מיקום שלא ראינו קודם. אם זה אתה — אין צורך לעשות כלום.
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:16px 0;">
          <table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;">
            <tr><td style="padding:4px 0;color:#64748b;width:90px;">מכשיר</td><td style="padding:4px 0;font-weight:600;">${escape(device)}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">מיקום</td><td style="padding:4px 0;font-weight:600;">${escape(location)}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">שיטת התחברות</td><td style="padding:4px 0;font-weight:600;">${escape(methodLabel)}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;">זמן</td><td style="padding:4px 0;font-weight:600;">${escape(whenLabel)}</td></tr>
          </table>
        </div>
        <p style="margin:16px 0 8px;font-size:14px;font-weight:600;color:#dc2626;">
          לא זיהית את הפעולה הזו?
        </p>
        <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#334155;">
          כנס להגדרות האבטחה, אפס את הסיסמה והתנתק מכל המכשירים.
        </p>
        <div style="text-align:center;margin:20px 0 8px;">
          <a href="${escape(securityUrl)}" style="display:inline-block;background:#f97316;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
            פתח הגדרות אבטחה
          </a>
        </div>
      </div>
      ${brandFooter()}
    </div>
  `;

  await sendEmail({
    to: params.to,
    subject: "\u200Fהתראת אבטחה: התחברות חדשה ל-Petra",
    html,
  });
}

/**
 * Check if the current request fingerprint is new for this user; if so, send
 * an alert email. Call BEFORE any session cleanup (so prior sessions are still
 * queryable). Safe to await on login path — catches and swallows errors.
 */
export async function alertIfNewDevice(params: {
  userId: string;
  email: string;
  name: string | null;
  request: Request;
  method: "password" | "google";
}): Promise<void> {
  try {
    const fp = fingerprintRequest(params.request);
    const known = await getKnownFingerprints(params.userId);
    if (known.has(fp.key)) return; // familiar device
    await sendNewDeviceAlertEmail({
      to: params.email,
      name: params.name,
      fp,
      when: new Date(),
      method: params.method,
    });
  } catch (err) {
    // Never block login on alert failures
    console.error("[login-alerts] sendNewDeviceAlert failed:", err);
  }
}
