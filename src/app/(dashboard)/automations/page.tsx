import { redirect } from "next/navigation";

// Automations were merged into /messages — redirect for any existing links
export default function AutomationsPage() {
  redirect("/messages");
}
