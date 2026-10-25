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
import { readEnv } from "@/lib/read-env";
import { alertAllDogFailure } from "@/lib/alldog/failure-alerts";

const LOG = "[alldog-bot/wa]";

function config(): { token: string; phoneNumberId: string; version: string } | null {
  const token = readEnv("ALLDOG_WA_TOKEN");
  const phoneNumberId = readEnv("ALLDOG_WA_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId, version: readEnv("ALLDOG_WA_GRAPH_VERSION") || "v21.0" };
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
    // Item 31: Or hears about it at once (≤ 1 per 30 min).
    await alertAllDogFailure({ kind: "wa_send", error: r.error ?? "send failed", phone: to });
    return null;
  }
  return r.data?.messages?.[0]?.id ?? null;
}

/**
 * Send an approved template without variables (e.g. missed_call_followup — item 32). Works outside
 * the 24h window. Returns the wamid, or null on failure (Or is alerted, ≤ 1 / 30 min). Never retried here.
 */
export async function sendTemplate(to: string, name: string, language: string, bodyParams: string[] = []): Promise<string | null> {
  const template: Record<string, unknown> = { name, language: { code: language } };
  if (bodyParams.length) {
    template.components = [{ type: "body", parameters: bodyParams.map((text) => ({ type: "text", text })) }];
  }
  const r = await post({ recipient_type: "individual", to, type: "template", template });
  if (!r.ok) {
    console.error(`${LOG} template ${name} to ${maskPhone(to)} failed: ${r.error}`);
    await alertAllDogFailure({ kind: "wa_send", error: r.error ?? "send failed", detail: `תבנית ${name}`, phone: to });
    return null;
  }
  return r.data?.messages?.[0]?.id ?? null;
}

/** WhatsApp voice notes are ≤ 16 MB; anything bigger is refused. */
const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

/**
 * Download an inbound media file (voice note): GET /{media-id} → a short-lived URL → the bytes,
 * both with the bot's token. Returns null on any failure (logged without the token / URL).
 */
export async function downloadMedia(mediaId: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const c = config();
  if (!c) return null;
  try {
    const metaRes = await fetch(`https://graph.facebook.com/${c.version}/${encodeURIComponent(mediaId)}`, {
      headers: { Authorization: `Bearer ${c.token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!metaRes.ok) {
      console.error(`${LOG} media lookup failed: HTTP ${metaRes.status}`);
      return null;
    }
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string; file_size?: number };
    if (!meta.url || (meta.file_size && meta.file_size > MAX_MEDIA_BYTES)) {
      console.error(`${LOG} media lookup: no url or too big`);
      return null;
    }
    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${c.token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!fileRes.ok) {
      console.error(`${LOG} media download failed: HTTP ${fileRes.status}`);
      return null;
    }
    const data = await fileRes.arrayBuffer();
    if (!data.byteLength || data.byteLength > MAX_MEDIA_BYTES) return null;
    return { data, contentType: (meta.mime_type || fileRes.headers.get("content-type") || "audio/ogg").split(";")[0].trim() };
  } catch (err) {
    console.error(`${LOG} media download failed:`, err instanceof Error ? err.message : "error");
    return null;
  }
}
