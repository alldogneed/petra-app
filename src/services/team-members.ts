/**
 * Team members of a business (PlatformUser ids via BusinessUser) — shared by appointment
 * assignment (Appointment.assignedToUserId) and staff absences (AvailabilityBlock.userId).
 * גבעת הכלבים 25/11/2026, א.40 + א.41.
 */
import prisma from "@/lib/prisma";
import { ServiceError } from "./types";

export interface TeamMemberRef { id: string; name: string }

/** Active members of the business, oldest first. */
export async function listActiveMembers(businessId: string): Promise<TeamMemberRef[]> {
  const rows = await prisma.businessUser.findMany({
    where: { businessId, isActive: true },
    select: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ id: r.user.id, name: r.user.name ?? "" }));
}

/**
 * The PlatformUser id must be an ACTIVE member of this business (IDOR guard).
 * null / "" → null (clears the assignment). Throws VALIDATION otherwise.
 */
export async function resolveMemberId(businessId: string, userId: string | null | undefined): Promise<string | null> {
  if (userId === null || userId === undefined || userId === "") return null;
  const m = await prisma.businessUser.findUnique({
    where: { businessId_userId: { businessId, userId } },
    select: { isActive: true },
  });
  if (!m || !m.isActive) throw new ServiceError("איש הצוות לא נמצא בעסק זה", "VALIDATION");
  return userId;
}

/**
 * For MCP: a member by id OR by name (exact, case-insensitive, trimmed; a unique first-name
 * match also counts). Returns null when nothing matches or the name is ambiguous.
 */
export function matchMember(members: TeamMemberRef[], idOrName: string): TeamMemberRef | null {
  const q = idOrName.trim();
  if (!q) return null;
  const byId = members.find((m) => m.id === q);
  if (byId) return byId;
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const exact = members.filter((m) => norm(m.name) === norm(q));
  if (exact.length === 1) return exact[0];
  const first = members.filter((m) => norm(m.name).split(" ")[0] === norm(q));
  return first.length === 1 ? first[0] : null;
}
