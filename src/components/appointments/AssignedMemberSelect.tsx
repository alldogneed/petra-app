"use client";

/**
 * "עובד" select for appointment forms (Appointment.assignedToUserId, א.41).
 * Lists the business's active members from GET /api/team-members; renders nothing
 * when the business has fewer than 2 members. Value "" = "ללא שיוך" (send null).
 */
import { useQuery } from "@tanstack/react-query";

export interface TeamMemberOption { id: string; name: string; avatarUrl?: string | null }

export function useTeamMembers(enabled = true) {
  return useQuery<TeamMemberOption[]>({
    queryKey: ["team-members"],
    queryFn: async () => {
      const r = await fetch("/api/team-members");
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled,
    staleTime: 60_000,
  });
}

export function AssignedMemberSelect({
  value,
  onChange,
  enabled = true,
  className,
  labelClassName = "label",
}: {
  value: string;
  onChange: (id: string) => void;
  enabled?: boolean;
  className?: string;
  labelClassName?: string;
}) {
  const { data: members = [] } = useTeamMembers(enabled);
  if (members.length < 2) return null;
  // Keep a pre-filled member that is no longer active selectable instead of silently dropping it.
  const known = !value || members.some((m) => m.id === value);
  return (
    <div className={className}>
      <label className={labelClassName}>עובד</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">ללא שיוך</option>
        {!known && <option value={value}>איש צוות לא פעיל</option>}
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.name || "ללא שם"}</option>
        ))}
      </select>
    </div>
  );
}
