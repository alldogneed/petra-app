"use client";

import { useQuery } from "@tanstack/react-query";

interface TeamMemberRow {
  id: string;
  name: string | null;
}

/**
 * "חסימה עבור" — whole business (default, value "") or one active member's absence.
 * Renders nothing when the business has fewer than 2 active members.
 * גבעת הכלבים 25/11/2026, א.40.
 */
export function BlockMemberSelect({
  value,
  onChange,
  className,
  labelClassName,
}: {
  value: string;
  onChange: (userId: string) => void;
  className?: string;
  labelClassName?: string;
}) {
  const { data: members = [] } = useQuery<TeamMemberRow[]>({
    queryKey: ["team-members"],
    queryFn: async () => {
      const r = await fetch("/api/team-members");
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
    staleTime: 60_000,
  });

  if (members.length < 2) return null;

  return (
    <div>
      <label className={labelClassName ?? "label"}>חסימה עבור</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={className ?? "input"}>
        <option value="">כל העסק</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name || "איש צוות"}
          </option>
        ))}
      </select>
      <p className="text-xs text-petra-muted mt-1">חסימה של עובד מוצגת ביומן ולא סוגרת הזמנות אונליין</p>
    </div>
  );
}
