/**
 * Owner notification service.
 * Sends a WhatsApp message + email to the Petra owner (Or) whenever a notable
 * event occurs (e.g. new user registration).
 *
 * WhatsApp: sent from Petra's official Meta Cloud API number to the owner's personal number.
 * Email:    sent via Resend to the owner's email address.
 */

const OWNER_WHATSAPP = "972542560964"; // Or's personal WhatsApp
const OWNER_EMAIL = "alldogneed@gmail.com"; // Or's email
const OWNER_NAME = "אור";

// ── WhatsApp ─────────────────────────────────────────────────────────────────

async function sendOwnerWhatsApp(message: string, templateParams?: string[]): Promise<void> {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.warn("[notify-owner] META credentials missing — skipping WhatsApp notification");
    return;
  }

  const send = async (body: object) => {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText);
    }
    return res;
  };

  try {
    // Try template first (works outside the 24h window — business-initiated)
    if (templateParams && templateParams.length > 0) {
      await send({
        messaging_product: "whatsapp",
        to: OWNER_WHATSAPP,
        type: "template",
        template: {
          name: "petra_owner_alert",
          language: { code: "he" },
          components: [
            {
              type: "body",
              parameters: templateParams.map((p) => ({ type: "text", text: p })),
            },
          ],
        },
      });
      return; // template succeeded
    }
  } catch (templateErr) {
    console.warn("[notify-owner] Template send failed, falling back to free-form text:", templateErr);
  }

  // Fallback: free-form text (works within 24h window only)
  try {
    await send({
      messaging_product: "whatsapp",
      to: OWNER_WHATSAPP,
      type: "text",
      text: { body: message },
    });
  } catch (err) {
    console.error("[notify-owner] WhatsApp free-form send also failed:", err);
    console.error("[notify-owner] TIP: Approve 'petra_owner_alert' template in Meta Business Manager to fix this permanently");
  }
}

// ── Email ─────────────────────────────────────────────────────────────────────

async function sendOwnerEmail(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[notify-owner] RESEND_API_KEY missing — skipping email notification");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Petra <noreply@petra-app.com>",
        to: [OWNER_EMAIL],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[notify-owner] Email send failed:", err);
    }
  } catch (err) {
    console.error("[notify-owner] Email error:", err);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface NewUserParams {
  name: string;
  email: string;
  plan?: string;
  phone?: string;
}

function formatPlan(plan?: string): string {
  const map: Record<string, string> = {
    free: "חינמי",
    basic: "Basic ₪99/חודש",
    pro: "Pro ₪199/חודש",
  };
  return map[plan ?? "free"] ?? "חינמי";
}

function formatDate(): string {
  return new Date().toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Notify the owner about a new user registration.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function notifyOwnerNewUser(params: NewUserParams): Promise<void> {
  const { name, email, plan, phone } = params;
  const planLabel = formatPlan(plan);
  const dateLabel = formatDate();

  // ── WhatsApp message ──────────────────────────────────────────────────────
  const waMessage =
    `היי ${OWNER_NAME} 👋\n\n` +
    `רציתי לעדכן אותך שנרשם משתמש חדש לפטרה!\n\n` +
    `👤 שם: ${name}\n` +
    `📧 אימייל: ${email}\n` +
    (phone ? `📞 טלפון: ${phone}\n` : "") +
    `📦 מסלול: ${planLabel}\n` +
    `🕐 תאריך: ${dateLabel}\n\n` +
    `בהצלחה! 🐾`;

  // ── Email ─────────────────────────────────────────────────────────────────
  const emailSubject = `משתמש חדש נרשם לפטרה — ${name}`;
  const emailHtml = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f8fafc; border-radius: 12px;">
      <div style="background: #1e293b; padding: 20px 24px; border-radius: 8px 8px 0 0; text-align: center;">
        <h2 style="color: #fb923c; margin: 0; font-size: 20px;">🐾 Petra</h2>
        <p style="color: #94a3b8; margin: 4px 0 0; font-size: 13px;">מערכת ניהול לעסקי חיות מחמד</p>
      </div>
      <div style="background: #ffffff; padding: 24px; border-radius: 0 0 8px 8px; border: 1px solid #e2e8f0;">
        <p style="font-size: 16px; color: #1e293b; margin-top: 0;">היי ${OWNER_NAME} 👋</p>
        <p style="color: #475569;">נרשם משתמש חדש לפטרה!</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 4px; color: #64748b; font-size: 13px; width: 100px;">שם</td>
            <td style="padding: 8px 4px; color: #1e293b; font-weight: 600;">${name}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 4px; color: #64748b; font-size: 13px;">אימייל</td>
            <td style="padding: 8px 4px; color: #1e293b;">${email}</td>
          </tr>
          ${phone ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px 4px; color: #64748b; font-size: 13px;">טלפון</td><td style="padding: 8px 4px; color: #1e293b;">${phone}</td></tr>` : ""}
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 4px; color: #64748b; font-size: 13px;">מסלול</td>
            <td style="padding: 8px 4px; color: #f97316; font-weight: 600;">${planLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px 4px; color: #64748b; font-size: 13px;">תאריך</td>
            <td style="padding: 8px 4px; color: #1e293b;">${dateLabel}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 12px 16px; background: #fff7ed; border-radius: 8px; border: 1px solid #fed7aa;">
          <p style="margin: 0; font-size: 13px; color: #9a3412;">
            💡 לצפייה במשתמש: <a href="https://petra-app.com/admin/users" style="color: #f97316;">פאנל ניהול</a>
          </p>
        </div>
      </div>
    </div>
  `;

  // Template params for petra_owner_alert (business-initiated — no 24h window restriction)
  const templateParams = [name, email, planLabel, dateLabel];

  // Send both in parallel, fire-and-forget
  await Promise.allSettled([
    sendOwnerWhatsApp(waMessage, templateParams),
    sendOwnerEmail(emailSubject, emailHtml),
  ]);
}
