/**
 * AllDog WhatsApp number — Cloud API calls for the bot only.
 *
 * The number lives in a SEPARATE Meta app ("Alldog-center"), not in Petra's platform
 * app and not in WhatsAppConnection — so this does NOT go through whatsapp.ts /
 * resolveWhatsAppSender(). Env: ALLDOG_WA_TOKEN, ALLDOG_WA_PHONE_NUMBER_ID,
 * ALLDOG_WA_GRAPH_VERSION (default v21.0). The token is never logged.
 *
 * Free text only: callers must check the 24h window (botMayReply) before sendText().
 */
import { maskPhone } from "@/lib/whatsapp-failure";

const LOG = "[alldog-bot/wa]";

function config(): { token: string; phoneNumberId: string; version: string } | null {
  const token = process.env.ALLDOG_WA_TOKEN?.trim();
  const phoneNumberId = process.env.ALLDOG_WA_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId, version: process.env.ALLDOG_WA_GRAPH_VERSION?.trim() || "v21.0" };
}

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; data?: { messages?: Array<{ id?: string }> }; error?: string }> {
  const c = config();
  if (!c) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch(`https://graph.facebook.com/${c.version}/${c.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch { /* keep null */ }
    if (!res.ok) {
      const e = (data as { error?: { code?: number; message?: string } } | null)?.error;
      return { ok: false, error: `${res.status} ${e?.code ?? ""} ${(e?.message ?? "").slice(0, 200)}`.trim() };
    }
    return { ok: true, data: data as { messages?: Array<{ id?: string }> } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fetch failed" };
  }
}

/** Blue ticks + "typing…" (shown up to ~25s or until our next message). Never throws. */
export async function markReadWithTyping(messageId: string): Promise<void> {
  const r = await post({ status: "read", message_id: messageId, typing_indicator: { type: "text" } });
  if (!r.ok) console.warn(`${LOG} read/typing failed: ${r.error}`);
}

/** Send free text. Returns the wamid, or null on failure. */
export async function sendText(to: string, body: string): Promise<string | null> {
  const r = await post({ recipient_type: "individual", to, type: "text", text: { preview_url: false, body } });
  if (!r.ok) {
    console.error(`${LOG} send to ${maskPhone(to)} failed: ${r.error}`);
    return null;
  }
  return r.data?.messages?.[0]?.id ?? null;
}
