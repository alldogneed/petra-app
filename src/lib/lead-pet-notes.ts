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

const PET_FIELD_LABELS: Array<[keyof LeadPetDetails, string]> = [
  ["name", "שם"],
  ["breed", "גזע"],
  ["age", "גיל"],
  ["notes", "הערות"],
];

/** The block's start/end in the notes (end = the first blank line after it, or the end). */
function petBlockRange(notes: string): [number, number] | null {
  const start = notes.indexOf(PET_BLOCK_HEADER);
  if (start < 0) return null;
  const blank = notes.slice(start).search(/\n\s*\n/);
  return [start, blank < 0 ? notes.length : start + blank];
}

/** The pet details written by formatPetNotesBlock(), or null when the notes have no block. */
export function parsePetNotesBlock(notes: string | null | undefined): LeadPetDetails | null {
  if (!notes) return null;
  const range = petBlockRange(notes);
  if (!range) return null;
  const out: LeadPetDetails = {};
  for (const line of notes.slice(range[0], range[1]).split("\n").slice(1)) {
    for (const [key, label] of PET_FIELD_LABELS) {
      if (line.startsWith(`${label}: `)) out[key] = line.slice(label.length + 2).trim() || null;
    }
  }
  return out;
}

/**
 * The newest details win (AllDog bot, item 30c): another dog's name → the block starts over;
 * the same dog → fields given now replace the old ones, the rest stay.
 */
export function mergePetDetails(old: LeadPetDetails | null, next: LeadPetDetails): LeadPetDetails {
  const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
  const otherDog = !!old && norm(next.name) !== "" && norm(old.name) !== "" && norm(next.name) !== norm(old.name);
  const base = otherDog || !old ? {} : old;
  const out: LeadPetDetails = { ...base };
  for (const [key] of PET_FIELD_LABELS) if (norm(next[key])) out[key] = norm(next[key]);
  return out;
}

/** Replace the pet block in the notes (or append it when there is none). */
export function replacePetNotesBlock(notes: string | null | undefined, block: string): string {
  const current = notes ?? "";
  const range = petBlockRange(current);
  if (!range) return [current.trim(), block].filter(Boolean).join("\n\n");
  return `${current.slice(0, range[0])}${block}${current.slice(range[1])}`.trim();
}
