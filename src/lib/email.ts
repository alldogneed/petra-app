/**
 * Email service powered by Resend.
 * Used for transactional emails (welcome, password reset, etc.)
 */

import { Resend } from "resend";

/** Escapes user-controlled strings before inserting into HTML email templates. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

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

// ─── Brand email wrapper helpers ────────────────────────────────────────────

export function brandHeader(): string {
  return `
        <div style="background:linear-gradient(135deg,#f97316,#fb923c);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0;">
          <img src="https://petra-app.com/petra-logo.png" alt="Petra" width="64" height="64" style="display:block;margin:0 auto 12px;border-radius:12px;" />
          <h1 style="color:#fff;margin:0;font-size:28px;font-weight:800;">Petra</h1>
          <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">ניהול עסקי חיות מחמד</p>
        </div>`;
}

export function brandFooter(): string {
  return `
        <div style="background:#f8fafc;padding:16px 24px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;">Petra — ניהול עסקי חיות מחמד — <a href="https://petra-app.com" style="color:#f97316;text-decoration:none;">petra-app.com</a></p>
        </div>`;
}

// ─── Checkout Welcome Email (immediate-payment checkout-first flow) ──────────

export interface CheckoutWelcomeEmailParams {
  to: string;
  name: string;
  tierName: string;
  tierPrice: number;
  tempPassword: string;
}

export async function sendCheckoutWelcomeEmail(params: CheckoutWelcomeEmailParams): Promise<void> {
  const resend = getResend();
  const appUrl = process.env.APP_URL || "https://petra-app.com";
  const loginUrl = `${appUrl}/login`;

  const { to, name, tierName, tierPrice, tempPassword } = params;
  const safeName = escapeHtml(name);
  const safeTo   = escapeHtml(to);
  const safeTier = escapeHtml(tierName);
  const safePass = escapeHtml(tempPassword);

  await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: `\u200Fהמנוי שלך ב-Petra פעיל — פרטי הכניסה`,
    html: `
      <div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b;background:#ffffff;">
        ${brandHeader()}

        <!-- Body -->
        <div style="padding:32px 24px;background:#fff;">
          <h2 style="font-size:20px;margin:0 0 8px;color:#0f172a;">שלום ${safeName}!</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
            החשבון שלך ב-Petra נוצר בהצלחה.<br/>
            <strong>המנוי שלך למסלול ${safeTier} פעיל</strong> — ניתן להתחיל לעבוד עכשיו.
          </p>

          <!-- Credentials box -->
          <div style="background:#fff7ed;border:2px solid #f97316;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
            <p style="font-size:13px;font-weight:700;color:#9a3412;letter-spacing:0.05em;margin:0 0 14px;">פרטי כניסה למערכת</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;width:70px;">אימייל</td>
                <td style="padding:8px 0;font-size:15px;font-weight:700;color:#0f172a;">${safeTo}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;">סיסמה</td>
                <td style="padding:8px 0;">
                  <code style="background:#1e293b;color:#f8fafc;font-size:16px;font-weight:700;padding:6px 14px;border-radius:6px;font-family:monospace;letter-spacing:0.08em;">${safePass}</code>
                </td>
              </tr>
            </table>
          </div>

          <!-- CTA Button -->
          <div style="text-align:center;margin:0 0 24px;">
            <a href="${loginUrl}" style="display:inline-block;background:#f97316;color:#fff;font-size:16px;font-weight:700;padding:14px 40px;border-radius:12px;text-decoration:none;">
              ← כניסה למערכת
            </a>
          </div>

          <!-- Change password note -->
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:0 0 24px;">
            <p style="margin:0;font-size:13px;color:#92400e;">
              <strong>מומלץ:</strong> לשנות את הסיסמה הזמנית בכניסה הראשונה —<br/>
              הגדרות ← פרטי משתמש ← שינוי סיסמה
            </p>
          </div>

          <!-- Subscription info -->
          <div style="border-top:1px solid #e2e8f0;padding-top:20px;">
            <p style="font-size:13px;color:#64748b;margin:0 0 8px;">
              המנוי פעיל מיד, חידוש אוטומטי ₪${tierPrice}/חודש<br/>
              ביטול בכל עת: הגדרות ← ניהול מנוי, ללא קנסות
            </p>
          </div>
        </div>

        ${brandFooter()}
      </div>
    `,
  });
}

// ─── Upgrade Confirmation Email (existing user upgraded plan) ────────────────

export interface UpgradeConfirmationEmailParams {
  to: string;
  name: string;
  tierName: string;
  tierPrice: number;
}

export async function sendUpgradeConfirmationEmail(params: UpgradeConfirmationEmailParams): Promise<void> {
  const resend = getResend();
  const appUrl = process.env.APP_URL || "https://petra-app.com";
  const dashboardUrl = `${appUrl}/dashboard`;

  const { to, name, tierName, tierPrice } = params;
  const safeName = escapeHtml(name);
  const safeTier = escapeHtml(tierName);

  await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: `\u200Fהמנוי שלך שודרג למסלול ${safeTier} — Petra`,
    html: `
      <div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b;background:#ffffff;">
        ${brandHeader()}

        <!-- Body -->
        <div style="padding:32px 24px;background:#fff;">
          <h2 style="font-size:20px;margin:0 0 8px;color:#0f172a;">שלום ${safeName}!</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
            המנוי שלך שודרג בהצלחה.<br/>
            <strong>מסלול ${safeTier} פעיל עכשיו</strong> — כל התכונות החדשות זמינות לך מיד.
          </p>

          <!-- Plan info box -->
          <div style="background:#fff7ed;border:2px solid #f97316;border-radius:12px;padding:20px 24px;margin:0 0 24px;text-align:center;">
            <p style="font-size:13px;font-weight:700;color:#9a3412;letter-spacing:0.05em;margin:0 0 8px;">המסלול שלך</p>
            <p style="font-size:24px;font-weight:800;color:#0f172a;margin:0 0 4px;">${safeTier}</p>
            <p style="font-size:14px;color:#64748b;margin:0;">₪${tierPrice} לחודש</p>
          </div>

          <!-- CTA Button -->
          <div style="text-align:center;margin:0 0 24px;">
            <a href="${dashboardUrl}" style="display:inline-block;background:#f97316;color:#fff;font-size:16px;font-weight:700;padding:14px 40px;border-radius:12px;text-decoration:none;">
              ← המשך לדאשבורד
            </a>
          </div>

          <!-- Subscription info -->
          <div style="border-top:1px solid #e2e8f0;padding-top:20px;">
            <p style="font-size:13px;color:#64748b;margin:0 0 8px;">
              המנוי מתחדש אוטומטית כל חודש, ₪${tierPrice}/חודש<br/>
              ביטול בכל עת: הגדרות ← ניהול מנוי, ללא קנסות
            </p>
          </div>
        </div>

        ${brandFooter()}
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
    subject: `\u200Fברוכים הבאים ל-Petra — החשבון שלך מוכן`,
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
    ? `\u200Fבקשת איפוס סיסמה — חשבון Google`
    : `\u200Fאיפוס סיסמה ל-Petra`;
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
  const safeName = escapeHtml(params.name);

  if (params.isGoogleAccount) {
    return `
      <div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b;background:#ffffff;">
        ${brandHeader()}

        <div style="padding:32px 24px;background:#fff;">
          <h2 style="font-size:20px;margin:0 0 8px;color:#0f172a;">שלום ${safeName}!</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
            קיבלנו בקשה לאיפוס סיסמה עבור החשבון שלך, אך החשבון שלך מחובר דרך Google ואין לו סיסמה עצמאית.
          </p>

          <div style="background:#fff7ed;border:2px solid #f97316;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
            <p style="font-size:14px;font-weight:700;color:#9a3412;margin:0;">
              על מנת להתחבר, השתמש בכפתור "התחברות עם Google" בדף הכניסה.
            </p>
          </div>

          <div style="text-align:center;margin:0 0 24px;">
            <a href="${appUrl}/login" style="display:inline-block;background:#f97316;color:#fff;font-size:16px;font-weight:700;padding:14px 40px;border-radius:12px;text-decoration:none;">
              ← לדף הכניסה
            </a>
          </div>
        </div>

        ${brandFooter()}
      </div>`;
  }

  const safeResetUrl = params.resetUrl || "";

  return `
      <div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b;background:#ffffff;">
        ${brandHeader()}

        <div style="padding:32px 24px;background:#fff;">
          <h2 style="font-size:20px;margin:0 0 8px;color:#0f172a;">שלום ${safeName}!</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
            קיבלנו בקשה לאיפוס הסיסמה שלך.
          </p>

          <div style="background:#fff7ed;border:2px solid #f97316;border-radius:12px;padding:20px 24px;margin:0 0 24px;text-align:center;">
            <p style="font-size:14px;font-weight:700;color:#9a3412;margin:0 0 16px;">הלינק בתוקף ל-60 דקות בלבד</p>
            <a href="${safeResetUrl}" style="display:inline-block;background:#f97316;color:#fff;font-size:16px;font-weight:700;padding:14px 40px;border-radius:12px;text-decoration:none;">
              ← איפוס סיסמה
            </a>
          </div>

          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:0 0 24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#92400e;">
              אם הלינק לא עובד, העתק את הכתובת הבאה לדפדפן:
            </p>
            <p style="margin:0;font-size:12px;color:#0f172a;word-break:break-all;" dir="ltr">${safeResetUrl}</p>
          </div>

          <div style="border-top:1px solid #e2e8f0;padding-top:20px;">
            <p style="font-size:13px;color:#64748b;margin:0;">
              לא ביקשת לאפס את הסיסמה? אפשר להתעלם מהמייל הזה. הסיסמה לא תשתנה.
            </p>
          </div>
        </div>

        ${brandFooter()}
      </div>`;
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
  const safeName = escapeHtml(params.name);
  const safeInviter = escapeHtml(params.inviterName);
  const safeBusiness = escapeHtml(params.businessName);
  const safeTo = escapeHtml(params.to);
  const safePass = escapeHtml(params.tempPassword);

  const { error } = await getResend().emails.send({
    from: getFromEmail(),
    to: params.to,
    subject: `\u200Fהוזמנת להצטרף ל-${params.businessName} ב-Petra`,
    html: `
      <div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b;background:#ffffff;">
        ${brandHeader()}

        <div style="padding:32px 24px;background:#fff;">
          <h2 style="font-size:20px;margin:0 0 8px;color:#0f172a;">שלום ${safeName}!</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
            ${safeInviter} הזמין/ה אותך להצטרף ל<strong>${safeBusiness}</strong> בתפקיד <strong>${roleLabel}</strong>.
          </p>

          <!-- Credentials box -->
          <div style="background:#fff7ed;border:2px solid #f97316;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
            <p style="font-size:13px;font-weight:700;color:#9a3412;letter-spacing:0.05em;margin:0 0 14px;">פרטי כניסה למערכת</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;width:90px;">אימייל</td>
                <td style="padding:8px 0;font-size:15px;font-weight:700;color:#0f172a;">${safeTo}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;">סיסמה זמנית</td>
                <td style="padding:8px 0;">
                  <code style="background:#1e293b;color:#f8fafc;font-size:16px;font-weight:700;padding:6px 14px;border-radius:6px;font-family:monospace;letter-spacing:0.08em;">${safePass}</code>
                </td>
              </tr>
            </table>
          </div>

          <!-- CTA Button -->
          <div style="text-align:center;margin:0 0 24px;">
            <a href="${loginUrl}" style="display:inline-block;background:#f97316;color:#fff;font-size:16px;font-weight:700;padding:14px 40px;border-radius:12px;text-decoration:none;">
              ← כניסה למערכת
            </a>
          </div>

          <!-- Change password note -->
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:0 0 24px;">
            <p style="margin:0;font-size:13px;color:#92400e;">
              <strong>מומלץ:</strong> לשנות את הסיסמה הזמנית בכניסה הראשונה —<br/>
              הגדרות ← פרטי משתמש ← שינוי סיסמה
            </p>
          </div>

          <div style="border-top:1px solid #e2e8f0;padding-top:20px;">
            <p style="font-size:13px;color:#64748b;margin:0;">
              אם לא ביקשת חשבון זה, ניתן להתעלם מהודעה זו.
            </p>
          </div>
        </div>

        ${brandFooter()}
      </div>`,
  });

  if (error) {
    throw new Error(`Resend email failed: ${error.message}`);
  }
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
  screenshotBase64?: string | null;
}

export async function sendSupportTicketEmail(
  params: SupportTicketEmailParams
): Promise<void> {
  // Parse screenshot attachment if provided
  let attachments: { filename: string; content: Buffer }[] | undefined;
  if (params.screenshotBase64) {
    const match = params.screenshotBase64.match(/^data:image\/(\w+);base64,(.+)$/);
    if (match) {
      const ext = match[1];
      const data = Buffer.from(match[2], "base64");
      attachments = [{ filename: `screenshot.${ext}`, content: data }];
    }
  }

  const { error } = await getResend().emails.send({
    from: getFromEmail(),
    to: "info@petra-app.com",
    subject: `\u200Fפנייה חדשה מ-${params.businessName}: ${params.title}`,
    html: buildSupportTicketHtml(params),
    ...(attachments ? { attachments } : {}),
  });
  if (error) {
    throw new Error(`Resend email failed: ${error.message}`);
  }
}

function buildSupportTicketHtml(params: SupportTicketEmailParams): string {
  const safeBusiness = escapeHtml(params.businessName);
  const safeEmail = escapeHtml(params.userEmail);
  const safeTitle = escapeHtml(params.title);
  const safeDesc = escapeHtml(params.description);
  const safeTicketId = escapeHtml(params.ticketId.slice(-8));

  return `
      <div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b;background:#ffffff;">
        ${brandHeader()}

        <div style="padding:32px 24px;background:#fff;">
          <h2 style="font-size:20px;margin:0 0 8px;color:#0f172a;">פנייה חדשה למערכת</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
            כרטיס #${safeTicketId}
          </p>

          <!-- Ticket details box -->
          <div style="background:#fff7ed;border:2px solid #f97316;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#9a3412;font-size:14px;font-weight:700;width:80px;vertical-align:top;">עסק</td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${safeBusiness}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#9a3412;font-size:14px;font-weight:700;vertical-align:top;">מייל</td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;" dir="ltr">${safeEmail}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#9a3412;font-size:14px;font-weight:700;vertical-align:top;">כותרת</td>
                <td style="padding:8px 0;font-size:14px;color:#0f172a;">${safeTitle}</td>
              </tr>
              ${params.pageUrl ? `<tr>
                <td style="padding:8px 0;color:#9a3412;font-size:14px;font-weight:700;vertical-align:top;">דף</td>
                <td style="padding:8px 0;font-size:12px;color:#475569;" dir="ltr">${escapeHtml(params.pageUrl)}</td>
              </tr>` : ""}
            </table>
          </div>

          <!-- Description -->
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:0 0 24px;white-space:pre-wrap;font-size:14px;color:#334155;line-height:1.6;">${safeDesc}</div>

          <!-- CTA Button -->
          <div style="text-align:center;margin:0 0 24px;">
            <a href="${params.adminUrl}" style="display:inline-block;background:#f97316;color:#fff;font-size:16px;font-weight:700;padding:14px 40px;border-radius:12px;text-decoration:none;">
              ← פתח בממשק הניהול
            </a>
          </div>
        </div>

        ${brandFooter()}
      </div>`;
}

function buildWelcomeHtml(params: WelcomeEmailParams, loginUrl: string): string {
  const safeName = escapeHtml(params.name);
  const safeTo = escapeHtml(params.to);
  const safePass = escapeHtml(params.tempPassword);
  const safeBusiness = escapeHtml(params.businessName);

  return `
      <div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;color:#1e293b;background:#ffffff;">
        ${brandHeader()}

        <div style="padding:32px 24px;background:#fff;">
          <h2 style="font-size:20px;margin:0 0 8px;color:#0f172a;">שלום ${safeName}!</h2>
          <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">
            החשבון שלך ב-Petra נוצר בהצלחה עבור העסק <strong>${safeBusiness}</strong>.
          </p>

          <!-- Credentials box -->
          <div style="background:#fff7ed;border:2px solid #f97316;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
            <p style="font-size:13px;font-weight:700;color:#9a3412;letter-spacing:0.05em;margin:0 0 14px;">פרטי כניסה למערכת</p>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;width:70px;">אימייל</td>
                <td style="padding:8px 0;font-size:15px;font-weight:700;color:#0f172a;">${safeTo}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:14px;">סיסמה</td>
                <td style="padding:8px 0;">
                  <code style="background:#1e293b;color:#f8fafc;font-size:16px;font-weight:700;padding:6px 14px;border-radius:6px;font-family:monospace;letter-spacing:0.08em;">${safePass}</code>
                </td>
              </tr>
            </table>
          </div>

          <!-- CTA Button -->
          <div style="text-align:center;margin:0 0 24px;">
            <a href="${loginUrl}" style="display:inline-block;background:#f97316;color:#fff;font-size:16px;font-weight:700;padding:14px 40px;border-radius:12px;text-decoration:none;">
              ← כניסה למערכת
            </a>
          </div>

          <!-- Change password note -->
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:0 0 24px;">
            <p style="margin:0;font-size:13px;color:#92400e;">
              <strong>מומלץ:</strong> לשנות את הסיסמה הזמנית בכניסה הראשונה —<br/>
              הגדרות ← פרטי משתמש ← שינוי סיסמה
            </p>
          </div>
        </div>

        ${brandFooter()}
      </div>`;
}
