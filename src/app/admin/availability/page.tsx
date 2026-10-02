import { redirect } from "next/navigation";

// Tenant-scoped tool — lives in the business dashboard, not the platform panel.
export default function Page() {
  redirect("/availability");
}
