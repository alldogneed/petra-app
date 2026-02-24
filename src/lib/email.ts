/**
 * Email service powered by Resend.
 * Used for transactional emails (welcome, password reset, etc.)
 */

import { Resend } from "resend";

/** Lazy-initialized Resend client (avoids build-time error when API key is missing). */
let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not set — cannot send emails");
    }
    _resend = new Resend(apiKey);
  }
  return _resend;
}

function getFromEmail(): string {
  return process.env.EMAIL_FROM || "Petra <onboarding@resend.dev>";
}

// ─── Welcome Email ──────────────────────────────────────────────────────────────

export interface WelcomeEmailParams {
  to: string;
  name: string;
  tempPassword: string;
  businessName: string;
}

export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
  const loginUrl = `${process.env.APP_URL || "http://localhost:3000"}/login`;

  const { error } = await getResend().emails.send({
    from: getFromEmail(),
    to: params.to,
    subject: "ברוכים הבאים ל-Petra — החשבון שלך מוכן! 🐾",
    html: buildWelcomeHtml(params, loginUrl),
  });

  if (error) {
    throw new Error(`Resend email failed: ${error.message}`);
  }
}

function buildWelcomeHtml(params: WelcomeEmailParams, loginUrl: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; padding: 40px 20px; direction: rtl;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

    <div style="text-align: center; margin-bottom: 32px;">
      <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #F97316, #FB923C); border-radius: 14px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 28px;">🐾</span>
      </div>
      <h1 style="font-size: 24px; color: #1e293b; margin: 0 0 8px;">שלום ${params.name}! 👋</h1>
      <p style="color: #64748b; font-size: 15px; margin: 0;">החשבון שלך ב-Petra מוכן לשימוש</p>
    </div>

    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0 0 12px; font-weight: 600; color: #c2410c; font-size: 14px;">פרטי ההתחברות שלך:</p>
      <table style="width: 100%; font-size: 14px; color: #1e293b;">
        <tr>
          <td style="padding: 6px 0; font-weight: 500; width: 120px;">אימייל:</td>
          <td style="padding: 6px 0;" dir="ltr">${params.to}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 500;">סיסמה זמנית:</td>
          <td style="padding: 6px 0; font-family: monospace; letter-spacing: 1px; font-size: 15px;" dir="ltr">${params.tempPassword}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 500;">שם העסק:</td>
          <td style="padding: 6px 0;">${params.businessName}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${loginUrl}" style="display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px;">
        כניסה למערכת
      </a>
    </div>

    <div style="background: #f1f5f9; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0 0 8px; font-weight: 600; color: #334155; font-size: 14px;">מה עכשיו?</p>
      <ol style="margin: 0; padding-right: 20px; color: #475569; font-size: 13px; line-height: 1.8;">
        <li>התחבר/י למערכת עם הפרטים למעלה</li>
        <li>שנה/י את הסיסמה מיד לאחר ההתחברות הראשונה</li>
        <li>הגדר/י את פרטי העסק ואת השירותים שלך</li>
        <li>התחל/י לנהל את הלקוחות, התורים והפגישות שלך!</li>
      </ol>
    </div>

    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 13px; color: #dc2626;">
        ⚠️ <strong>חשוב:</strong> מומלץ לשנות את הסיסמה מיד לאחר ההתחברות הראשונה.
      </p>
    </div>

    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #94a3b8;">
        המייל נשלח ממערכת Petra — ניהול עסקי חיות מחמד
      </p>
      <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
        אם לא ביקשת חשבון זה, ניתן להתעלם מהודעה זו.
      </p>
    </div>
  </div>
</body>
</html>`;
}
