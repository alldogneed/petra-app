import { redirect } from "next/navigation";

// Broadcast was consolidated onto the authoritative implementation at
// /admin/messages (GET history + POST + PATCH edit + DELETE retract).
// This owner-panel copy is retired — redirect any existing links.
export default function BroadcastPage() {
  redirect("/admin/messages");
}
