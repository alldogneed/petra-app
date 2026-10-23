/**
 * Lead has no pet columns — pet details live in the notes as one "🐾 פרטי הכלב" block.
 * Shared by MCP create_lead and the AllDog automations so the block always looks the same.
 */

export const PET_BLOCK_HEADER = "🐾 פרטי הכלב:";

export interface LeadPetDetails {
  name?: string | null;
  breed?: string | null;
  age?: string | null;
  notes?: string | null;
}

/** "" when no detail was given. */
export function formatPetNotesBlock(p: LeadPetDetails): string {
  const bits: string[] = [];
  if (p.name?.trim()) bits.push(`שם: ${p.name.trim()}`);
  if (p.breed?.trim()) bits.push(`גזע: ${p.breed.trim()}`);
  if (p.age?.trim()) bits.push(`גיל: ${p.age.trim()}`);
  if (p.notes?.trim()) bits.push(`הערות: ${p.notes.trim()}`);
  return bits.length ? `${PET_BLOCK_HEADER}\n${bits.join("\n")}` : "";
}

export function hasPetNotesBlock(notes: string | null | undefined): boolean {
  return !!notes && notes.includes(PET_BLOCK_HEADER);
}
