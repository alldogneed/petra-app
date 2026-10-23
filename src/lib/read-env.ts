/**
 * Read an env var trimmed. Values added through the Vercel CLI (`echo … | vercel env add`)
 * often end in "\n" — e.g. PAYCALL_WEBHOOK_SECRET made every webhook call 401 and the
 * PAYCALL_PASSWORD Basic auth fail. Empty / whitespace-only = undefined.
 * Safe in any runtime (no imports).
 */
export function readEnv(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined) return undefined;
  const t = v.trim();
  return t === "" ? undefined : t;
}
