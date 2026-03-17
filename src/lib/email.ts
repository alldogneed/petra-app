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

// ─── Trial Welcome Email (checkout-first flow) ───────────────────────────────

export interface TrialWelcomeEmailParams {
  to: string;
  name: string;
  tierName: string;
  tierPrice: number;
  tempPassword: string;
}

export async function sendTrialWelcomeEmail(params: TrialWelcomeEmailParams): Promise<void> {
  const resend = getResend();
  const appUrl = process.env.APP_URL || "https://petra-app.com";
  const loginUrl = `${appUrl}/login`;

  const { to, name, tierName, tierPrice, tempPassword } = params;

  await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: `🎉 ברוכים הבאים ל-Petra! — פרטי הכניסה שלך`,
    html: `
      <div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b;background:#ffffff;">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#f97316,#fb923c);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800;">Petra 🐾</h1>
          <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">ניהול עסקי חיות מחמד</p>
        </div>

        <!-- Body -->
        <div style="padding:32px 24px;background:#fff;">
          <h2 style="font-size:20px;margin:0 0 8px;color:#0f172a;">שלום ${name}! 👋</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
            החשבון שלך ב-Petra נוצר בהצלחה.<br/>
            <strong>14 ימי ניסיון חינמי למסלול ${tierName}</strong> מתחילים עכשיו.
          </p>

          <!-- Credentials box -->
          <div style="background:#f8fafc;border:2px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
            <p style="font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">פרטי כניסה למערכת</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:14px;width:90px;">📧 אימייל</td>
                <td style="padding:6px 0;font-size:14px;font-weight:600;color:#0f172a;">${to}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#64748b;font-size:14px;">🔑 סיסמה</td>
                <td style="padding:6px 0;">
                  <code style="background:#1e293b;color:#f8fafc;font-size:15px;font-weight:700;padding:4px 10px;border-radius:6px;font-family:monospace;letter-spacing:0.05em;">${tempPassword}</code>
                </td>
              </tr>
            </table>
          </div>

          <!-- CTA Button -->
          <div style="text-align:center;margin:0 0 24px;">
            <a href="${loginUrl}" style="display:inline-block;background:#f97316;color:#fff;font-size:16px;font-weight:700;padding:14px 40px;border-radius:12px;text-decoration:none;">
              כניסה למערכת →
            </a>
          </div>

          <!-- Change password note -->
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:0 0 24px;">
            <p style="margin:0;font-size:13px;color:#92400e;">
              💡 <strong>מומלץ:</strong> שנה את הסיסמה הזמנית בכניסה הראשונה —<br/>
              הגדרות → פרטי משתמש → שינוי סיסמה
            </p>
          </div>

          <!-- Trial info -->
          <div style="border-top:1px solid #e2e8f0;padding-top:20px;">
            <p style="font-size:13px;color:#64748b;margin:0 0 8px;">
              ✅ <strong>הניסיון פעיל</strong> — 14 ימים מלאים ללא תשלום<br/>
              🔄 לאחר 14 יום: חיוב אוטומטי <strong>₪${tierPrice}/חודש</strong><br/>
              ❌ ביטול בניסיון? הגדרות → ניהול מנוי — <strong>₪0</strong>
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">Petra · ניהול עסקי חיות מחמד · <a href="https://petra-app.com" style="color:#f97316;text-decoration:none;">petra-app.com</a></p>
        </div>
      </div>
    `,
  });
}

// ─── Generic email sender ────────────────────────────────────────────────────

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const resend = getResend();
  await resend.emails.send({
    from: getFromEmail(),
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
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

// ─── Password Reset Email ────────────────────────────────────────────────────

export interface PasswordResetEmailParams {
  to: string;
  name: string;
  resetUrl: string | null;
  isGoogleAccount?: boolean;
}

export async function sendPasswordResetEmail(
  params: PasswordResetEmailParams
): Promise<void> {
  const subject = params.isGoogleAccount
    ? "בקשת איפוס סיסמה — חשבון Google"
    : "איפוס סיסמה ל-Petra 🔑";
  const { error } = await getResend().emails.send({
    from: getFromEmail(),
    to: params.to,
    subject,
    html: buildPasswordResetHtml(params),
  });

  if (error) {
    throw new Error(`Resend email failed: ${error.message}`);
  }
}

function buildPasswordResetHtml(params: PasswordResetEmailParams): string {
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  if (params.isGoogleAccount) {
    return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; padding: 40px 20px; direction: rtl;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <h1 style="font-size: 20px; color: #1e293b; margin: 0 0 16px;">שלום ${params.name},</h1>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
      קיבלנו בקשה לאיפוס סיסמה עבור החשבון שלך, אך החשבון שלך מחובר דרך Google ואין לו סיסמה עצמאית.
    </p>
    <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
      על מנת להתחבר, השתמש בכפתור "התחברות עם Google" בדף הכניסה.
    </p>
    <a href="${appUrl}/login"
       style="display: inline-block; background: linear-gradient(135deg, #F97316, #FB923C); color: white; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 600; font-size: 14px;">
      לדף הכניסה
    </a>
    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 32px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #94a3b8;">Petra — ניהול עסקי חיות מחמד</p>
    </div>
  </div>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; padding: 40px 20px; direction: rtl;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

    <div style="text-align: center; margin-bottom: 32px;">
      <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #F97316, #FB923C); border-radius: 14px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 28px;">🔑</span>
      </div>
      <h1 style="font-size: 22px; color: #1e293b; margin: 0 0 8px;">שלום ${params.name},</h1>
      <p style="color: #64748b; font-size: 15px; margin: 0;">קיבלנו בקשה לאיפוס הסיסמה שלך</p>
    </div>

    <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
      <p style="margin: 0 0 16px; font-size: 14px; color: #92400e;">הלינק בתוקף ל-60 דקות בלבד</p>
      <a href="${params.resetUrl}"
         style="display: inline-block; background: linear-gradient(135deg, #F97316, #FB923C); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px;">
        איפוס סיסמה
      </a>
    </div>

    <div style="background: #f1f5f9; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 13px; color: #475569;">
        אם הלינק לא עובד, העתק את הכתובת הבאה לדפדפן:
      </p>
      <p style="margin: 8px 0 0; font-size: 12px; color: #0f172a; word-break: break-all;" dir="ltr">${params.resetUrl}</p>
    </div>

    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 13px; color: #dc2626;">
        ⚠️ לא ביקשת לאפס את הסיסמה? אפשר להתעלם מהמייל הזה. הסיסמה לא תשתנה.
      </p>
    </div>

    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #94a3b8;">Petra — ניהול עסקי חיות מחמד</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Team Invitation Email ───────────────────────────────────────────────────

export interface TeamInvitationEmailParams {
  to: string;
  name: string;
  tempPassword: string;
  businessName: string;
  role: string;
  inviterName: string;
}

const ROLE_LABELS_HE: Record<string, string> = {
  owner: "בעלים",
  manager: "מנהל",
  user: "עובד",
  volunteer: "מתנדב",
};

export async function sendTeamInvitationEmail(params: TeamInvitationEmailParams): Promise<void> {
  const loginUrl = `${process.env.APP_URL || "http://localhost:3000"}/login`;
  const roleLabel = ROLE_LABELS_HE[params.role] || params.role;

  const { error } = await getResend().emails.send({
    from: getFromEmail(),
    to: params.to,
    subject: `הוזמנת להצטרף ל-${params.businessName} ב-Petra 🐾`,
    html: `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; padding: 40px 20px; direction: rtl;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #F97316, #FB923C); border-radius: 14px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 28px;">🐾</span>
      </div>
      <h1 style="font-size: 22px; color: #1e293b; margin: 0 0 8px;">שלום ${params.name}! 👋</h1>
      <p style="color: #64748b; font-size: 15px; margin: 0;">${params.inviterName} הזמין/ה אותך להצטרף ל<strong>${params.businessName}</strong></p>
    </div>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center;">
      <p style="margin: 0; font-size: 14px; color: #15803d;">התפקיד שלך: <strong>${roleLabel}</strong></p>
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
      </table>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${loginUrl}" style="display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 15px;">
        כניסה למערכת
      </a>
    </div>

    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 13px; color: #dc2626;">
        ⚠️ <strong>חשוב:</strong> מומלץ לשנות את הסיסמה מיד לאחר ההתחברות הראשונה.
      </p>
    </div>

    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #94a3b8;">Petra — ניהול עסקי חיות מחמד</p>
      <p style="margin: 0; font-size: 11px; color: #cbd5e1;">אם לא ביקשת חשבון זה, ניתן להתעלם מהודעה זו.</p>
    </div>
  </div>
</body>
</html>`,
  });

  if (error) {
    throw new Error(`Resend email failed: ${error.message}`);
  }
}

// ─── Trial Reminder Email ────────────────────────────────────────────────────

export interface TrialReminderEmailParams {
  to: string;
  name: string;
  tierName: string;
  daysLeft: number;
  trialEndsAt: Date;
}

export async function sendTrialReminderEmail(params: TrialReminderEmailParams): Promise<void> {
  const appUrl = process.env.APP_URL || "https://petra-app.com";
  const upgradeUrl = `${appUrl}/upgrade`;
  const isLastDay = params.daysLeft <= 1;
  const endDateStr = params.trialEndsAt.toLocaleDateString("he-IL", { day: "numeric", month: "long", year: "numeric" });

  const subject = isLastDay
    ? `⏰ הניסיון החינמי שלך ב-Petra מסתיים מחר`
    : `⏳ נשארו ${params.daysLeft} ימים לניסיון החינמי שלך ב-Petra`;

  const { error } = await getResend().emails.send({
    from: getFromEmail(),
    to: params.to,
    subject,
    html: buildTrialReminderHtml({ ...params, upgradeUrl, endDateStr, isLastDay }),
  });

  if (error) {
    throw new Error(`Resend trial reminder failed: ${error.message}`);
  }
}

function buildTrialReminderHtml(params: TrialReminderEmailParams & { upgradeUrl: string; endDateStr: string; isLastDay: boolean }): string {
  const accentColor = params.isLastDay ? "#DC2626" : "#F59E0B";
  const bgColor = params.isLastDay ? "#FEF2F2" : "#FFFBEB";
  const borderColor = params.isLastDay ? "#FECACA" : "#FDE68A";
  const emoji = params.isLastDay ? "⏰" : "⏳";

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; padding: 40px 20px; direction: rtl;">
  <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">

    <div style="text-align: center; margin-bottom: 28px;">
      <div style="width: 56px; height: 56px; background: linear-gradient(135deg, #F97316, #FB923C); border-radius: 14px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 28px;">${emoji}</span>
      </div>
      <h1 style="font-size: 22px; color: #1e293b; margin: 0 0 8px;">שלום ${params.name},</h1>
      <p style="color: #64748b; font-size: 15px; margin: 0;">הניסיון החינמי שלך ב-Petra מתקרב לסיומו</p>
    </div>

    <div style="background: ${bgColor}; border: 1px solid ${borderColor}; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
      <p style="margin: 0 0 6px; font-size: 28px; font-weight: 800; color: ${accentColor};">
        ${params.isLastDay ? "יום אחרון!" : `${params.daysLeft} ימים`}
      </p>
      <p style="margin: 0; font-size: 14px; color: #92400e;">
        מסלול <strong>${params.tierName}</strong> — בתוקף עד ${params.endDateStr}
      </p>
    </div>

    <p style="color: #475569; font-size: 14px; line-height: 1.7; margin: 0 0 20px;">
      כדי להמשיך ליהנות מכל הפיצ'רים של מסלול <strong>${params.tierName}</strong>, כולל יומן תורים, תזכורות WhatsApp ועוד — ניתן לשדרג בלחיצה אחת.
    </p>

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${params.upgradeUrl}"
         style="display: inline-block; background: linear-gradient(135deg, #F97316, #FB923C); color: white; text-decoration: none; padding: 14px 36px; border-radius: 12px; font-weight: 700; font-size: 15px;">
        שדרג עכשיו ←
      </a>
    </div>

    <div style="background: #f1f5f9; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.6;">
        💡 <strong>לא רוצה להמשיך?</strong> לא צריך לעשות כלום. ב-${params.endDateStr} החשבון יחזור אוטומטית למסלול החינמי ולא תחויב.
      </p>
    </div>

    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #94a3b8;">Petra — ניהול עסקי חיות מחמד</p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Support Ticket Email ────────────────────────────────────────────────────

export interface SupportTicketEmailParams {
  ticketId: string;
  businessName: string;
  userEmail: string;
  title: string;
  description: string;
  pageUrl?: string | null;
  adminUrl: string;
}

export async function sendSupportTicketEmail(
  params: SupportTicketEmailParams
): Promise<void> {
  const { error } = await getResend().emails.send({
    from: getFromEmail(),
    to: "info@petra-app.com",
    subject: `🐛 פנייה חדשה מ-${params.businessName}: ${params.title}`,
    html: buildSupportTicketHtml(params),
  });
  if (error) {
    throw new Error(`Resend email failed: ${error.message}`);
  }
}

function buildSupportTicketHtml(params: SupportTicketEmailParams): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; padding: 40px 20px; direction: rtl;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <div style="text-align: center; margin-bottom: 28px;">
      <div style="width: 52px; height: 52px; background: linear-gradient(135deg, #ef4444, #f97316); border-radius: 14px; margin: 0 auto 14px; display:flex; align-items:center; justify-content:center;">
        <span style="font-size: 26px;">🐛</span>
      </div>
      <h1 style="font-size: 20px; color: #1e293b; margin: 0 0 6px;">פנייה חדשה למערכת</h1>
      <p style="color: #64748b; font-size: 14px; margin: 0;">כרטיס #${params.ticketId.slice(-8)}</p>
    </div>
    <table style="width:100%; font-size:14px; color:#1e293b; border-collapse:collapse; margin-bottom:20px;">
      <tr><td style="padding:8px 0; font-weight:600; width:130px; vertical-align:top;">עסק:</td><td style="padding:8px 0;">${params.businessName}</td></tr>
      <tr><td style="padding:8px 0; font-weight:600; vertical-align:top;">מייל:</td><td style="padding:8px 0;" dir="ltr">${params.userEmail}</td></tr>
      <tr><td style="padding:8px 0; font-weight:600; vertical-align:top;">כותרת:</td><td style="padding:8px 0;">${params.title}</td></tr>
      ${params.pageUrl ? `<tr><td style="padding:8px 0; font-weight:600; vertical-align:top;">דף:</td><td style="padding:8px 0; font-size:12px; color:#475569;" dir="ltr">${params.pageUrl}</td></tr>` : ""}
    </table>
    <div style="background:#f1f5f9; border-radius:10px; padding:16px; margin-bottom:24px; white-space:pre-wrap; font-size:14px; color:#334155; line-height:1.6;">${params.description}</div>
    <div style="text-align:center;">
      <a href="${params.adminUrl}" style="display:inline-block; background:#1e293b; color:white; text-decoration:none; padding:12px 28px; border-radius:12px; font-weight:600; font-size:14px;">
        פתח בממשק הניהול
      </a>
    </div>
  </div>
</body>
</html>`;
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
