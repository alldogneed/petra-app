/**
 * MCP `assigned_to` helpers (Appointment.assignedToUserId, א.41) — pure, no DB.
 */

/** Hebrew error when `assigned_to` matched no member (or several), listing the active members. */
export function memberNotFoundMessage(query: string, memberNames: string[]): string {
  const names = memberNames.map((n) => n.trim()).filter(Boolean);
  const q = query.replace(/[\r\n\t]+/g, " ").trim().slice(0, 60);
  if (names.length === 0) return `לא נמצא איש צוות "${q}" — אין אנשי צוות פעילים בעסק`;
  return `לא נמצא איש צוות יחיד בשם "${q}". אנשי הצוות הפעילים: ${names.join(", ")} (אפשר להעביר שם מלא או מזהה)`;
}

/** `assigned_to` param → undefined (not passed), null (clear) or the trimmed query. */
export function parseAssignedToParam(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t ? t : null;
}
